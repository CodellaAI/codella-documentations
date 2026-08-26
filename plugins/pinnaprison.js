module.exports = {
    name: 'PinnaPrison',
    description: 'API to access PinnaPrison features: packet-based private mines, pickaxe enchants (custom API enchants with chaining), currencies (incl. external-plugin currencies), levelings, rebirth, backpacks (upgrades + attachments), autosell, boosters (incl. live boost providers), crystals, abilities, attributes, autominers, bombs, drills, mine powerups, gangs, pickaxe skins, pickaxe NBT persistence, variables, custom mine placeables, config-driven GUIs, action-bar control, number formatting and offline player data — plus the low-level EdLib API for packet-based fake entities, display styling, ModelEngine/MythicMobs models, mob variants, packet worlds and goal-based AI used to build crazy animated mine enchants.',
    pluginId: 'PinnaPrison',
    systemDownloadURL: `
        https://raw.githubusercontent.com/CodellaAI/codella-documentations/main/lib/PinnaPrison-API.jar
        https://raw.githubusercontent.com/CodellaAI/codella-documentations/main/lib/EdLib-API.jar
    `,
    dependencies: `
        Java 21
    `,
    mavenIntegration: `
        <repositories>
            // SYSTEM DEPENDENCY NO REPOSITORY
        </repositories>
        <dependencies>
            <!-- PinnaPrison main API -->
            <dependency>
                <groupId>es.edwardbelt</groupId>
                <artifactId>pinnaprison-api</artifactId>
                <version>1.0</version>
                <scope>system</scope>
                <systemPath>\${basedir}/lib/PinnaPrison-API.jar</systemPath>
            </dependency>

            <!-- EdLib low-level API (packet entities, models, goals) -->
            <dependency>
                <groupId>es.edwardbelt</groupId>
                <artifactId>edlib-api</artifactId>
                <version>1.0</version>
                <scope>system</scope>
                <systemPath>\${basedir}/lib/EdLib-API.jar</systemPath>
            </dependency>
        </dependencies>
    `,
    usage: `
        /**
         * PinnaPrison API Overview
         * Two system dependencies:
         *
         * EdLib-API.jar (es.edwardbelt.edlib.iapi):
         * - Low-level, packet-based server functionality (no real entities/blocks ever exist)
         * - Fake entity creation + manipulation (EdEntity), block/item/text displays with full
         *   display styling, armor-stand arm posing, real players as client-side passengers,
         *   mob variants, ModelEngine models with animations + smooth movement, MythicMobs lookup
         * - Goal-based AI for entity movement (EdGoal + impl goals)
         * - Action bars, XP bars, boss bars, per-player block packets, packet worlds (EdWorld)
         * - Cross-version (1.20.3 -> 1.26) NMS abstraction
         * - EVERYTHING in EdLib is packets, so it all runs fine ASYNCHRONOUSLY
         *
         * PinnaPrison-API.jar (es.edwardbelt.pinnaprison.iapi):
         * - High-level prison integration: mines, enchants, currencies, levelings, rebirth,
         *   backpacks, autosell, boosters, crystals, abilities, attributes, autominers, bombs,
         *   drills, powerups, gangs, pickaxe + pickaxe skins, variables and GUIs
         * - Register custom pickaxe (mine) enchants with full proc/animation behaviour
         * - Break + reward blocks exactly like vanilla mining
         * - Bridge external economies in, register live boost providers, custom mine placeables,
         *   custom GUI item types, control the action bar, format numbers like the server, keep
         *   your own NBT alive on the pickaxe, and read/edit OFFLINE players' data
         */

        plugin.yml: add only PinnaPrison as a 'depend' (EdLib's API ships inside the PinnaPrison jar):
        \`\`\`
        name: MyEnchants
        version: 1.0
        main: com.example.MyEnchants
        api-version: '1.20'
        depend: [PinnaPrison]
        \`\`\`

        ============================================================================
        !!! GOLDEN RULES — READ THIS BEFORE WRITING ANY CODE !!!
        ============================================================================
        These are not style preferences. Breaking any of them produces a broken enchant.

        1) ASYNC BY DEFAULT. A mine enchant declares \`asyncSafe() { return true; }\` and does only
           packet/data work: MineService break methods, EdLib entities/goals, currency changes,
           per-player particles/sounds. Everything in EdLib is packets, so entity creation,
           spawning, movement, goals, displays and ModelEngine models are ALL safe off the main
           thread and MUST stay off it (the mining pipeline is a Netty thread; hopping to the main
           thread for every proc destroys TPS). The ONLY exception is the ENDER DRAGON, whose
           constructor fires a Bukkit event Paper requires to be sync — create + spawn that one
           inside \`EdLibAPI.getExecutor().sync(...)\`, then animate it async as usual.

        2) PARTICLES AND SOUNDS ARE PACKETS, SO THEY ARE ASYNC TOO.
           \`player.spawnParticle(...)\` / \`player.playSound(...)\` only build and send a packet —
           call them directly from the async proc thread. Never schedule a sync task just for FX.

        3) ENTITIES BELONG TO THE MINE, NOT TO THE PLAYER.
           Show them with \`mines.spawnInMine(player, entity)\` and remove them with
           \`mines.despawnInMine(player, entity)\`. NEVER \`entity.addWatcher(p) + entity.spawn()\`
           and NEVER \`entity.remove()\` for something inside a mine. spawnInMine gives you: every
           current viewer sees it, members/visitors arriving mid-animation see it, it despawns when
           a player leaves or switches mines instead of following them, it is torn down with the
           mine, and it automatically honours the mob-entities toggle (rule 4).

        4) RESPECT ALL THE /settings TOGGLES. Every player can mute things in \`/settings\`:
             enchants.isMessagesDisabled(uuid)          -> chat
             enchants.isProcMessageDisabled(uuid, id)   -> this enchant's proc message
             enchants.isSoundsDisabled(uuid)            -> sounds
             enchants.isParticlesDisabled(uuid)         -> particles / visual FX
             enchants.isMobEntitiesDisabled(uuid)       -> packet MOBS spawned by enchants
             mines.isVirtualBlockBreaking(player)       -> "pay me, don't empty my mine"
           - Messages: just use \`enchants.sendProcMessage(...)\`; it checks both message toggles.
           - Sounds/particles: check PER VIEWER, inside the loop, before sending the packet.
           - Mob entities: \`spawnInMine\` already skips those viewers. Only check it yourself if
             you show an entity by hand (e.g. \`spawnForPlayer\`, or an \`addWatcher\` outside a mine).
             Text/block/item DISPLAYS are never affected by that toggle.
           - Virtual block breaking: the MineService break methods already handle it — they pay for
             every block and return the real count while leaving the mine standing. You only care
             if you faked blocks yourself (rule 5).

        5) VIRTUAL BLOCK BREAKING + FAKE BLOCKS. If your animation disguises blocks (e.g. turns a
           region to ICE before shattering it) use \`mines.disguiseBlocks(...)\` and ALWAYS
           \`mines.revealBlocks(...)\` when the animation ends. Normally the chunk resend after a
           break clears a disguise for free, but under Virtual Block Breaking nothing is broken and
           no resend happens, so the fake blocks would linger on the client forever.

        6) FX GO TO THE WHOLE MINE. Particles/sounds are per-player packets. Send them to
           \`mines.getMineViewers(player)\` (digger + co-op members + visitors), not just the digger,
           gating each viewer on their own toggle. The more (gated) particle FX, the better.

        7) NEVER HARDCODE A TUNABLE. Radius, speed, durations, currency ids, reward amounts, entity
           types, colours — all of it goes in the enchant's \`settings:\` yaml block and is read with
           \`enchants.getSettings(id)\` INSIDE onProc (so \`/pinna reload\` picks it up).

        8) NEVER TOUCH THE REAL WORLD. Mines have no real blocks and no real entities. All block
           work goes through MineService; all visuals go through EdLib packets.

        9) ALWAYS CLEAN UP. Every entity you spawn gets a despawn on the goal's endRunnable AND a
           fail-safe \`EdLibAPI.getExecutor().asyncLater(...)\` despawn, in case the player logs out
           or leaves the mine mid-animation.

        ============================================================================
        ENTRY POINT
        ============================================================================
        PinnaPrisonAPI interface: es.edwardbelt.pinnaprison.iapi
        Grab it AFTER PinnaPrison has enabled (your onEnable with depend: [PinnaPrison], or a
        delayed task). getInstance() returns null until PinnaPrison finished enabling.
        Static Methods:
        static void setInstance(PinnaPrisonAPI instance)
        static PinnaPrisonAPI getInstance()
        Instance Methods (sub-services):
        CurrencyService getCurrencies()
        EnchantService getEnchants()
        LevelingService getLeveling()
        PickaxeService getPickaxe()
        PickaxeSkinService getPickaxeSkins()
        MineService getMines()
        BackpackService getBackpacks()
        BoosterService getBoosters()
        CrystalService getCrystals()
        RebirthService getRebirth()
        AttributeService getAttributes()
        AbilityService getAbilities()
        AutominerService getAutominers()
        SellService getSell()
        BombService getBombs()
        DrillService getDrills()
        PowerupService getPowerups()        // mine powerups (floating owner-only boosts)
        GangService getGangs()
        PlayerDataService getPlayers()      // offline-capable raw data access
        PlaceableService getPlaceables()    // custom mine placeable types
        DisplayService getDisplay()         // action-bar control
        FormatService getFormat()           // format.yml number formatting/parsing
        GuiService getGuis()                // config-driven GUIs (iapi.gui package)
        VariableService getVariables()      // variables.yml static/changeable variables

        Example:
        \`\`\`java
        PinnaPrisonAPI api = PinnaPrisonAPI.getInstance();
        api.getCurrencies().addBalanceBoosted(uuid, "tokens", BigDecimal.valueOf(1000));
        \`\`\`

        ============================================================================
        SERVICES (es.edwardbelt.pinnaprison.iapi.service)
        ============================================================================
        Note: amounts are java.math.BigDecimal. ids are config file names (e.g. "tokens", "money",
        "gems", "rankupxp", "pickaxelevel", "rebirth"). All services are thread-safe unless a
        method says otherwise.

        ----------------------------------------------------------------------------
        CurrencyService
        ----------------------------------------------------------------------------
        Set<String> getCurrencyIds()
        boolean exists(String currencyId)
        String getDisplayName(String currencyId)
        boolean isBlockCurrency(String currencyId)              // granted per block mined
        BigDecimal getBalance(UUID playerId, String currencyId)
        void setBalance(UUID playerId, String currencyId, BigDecimal amount)
        void addBalance(UUID playerId, String currencyId, BigDecimal amount)
        void removeBalance(UUID playerId, String currencyId, BigDecimal amount)
        void addBalanceBoosted(UUID playerId, String currencyId, BigDecimal amount) // applies booster/crystal/attribute/rebirth/gang multipliers — ALWAYS use this for enchant rewards
        BigDecimal getBoostMultiplier(UUID playerId, String currencyId)             // total income multiplier (1 + bonuses)
        boolean has(UUID playerId, String currencyId, BigDecimal amount)
        void registerExternalCurrency(ExternalCurrency currency) // bridge another plugin's economy in
        boolean isExternal(String currencyId)
        ExternalCurrency (es.edwardbelt.pinnaprison.iapi.currency) — implement + register and its id works
        anywhere a currency id is used (enchant costs, autosell rewards, leveling costs, ...). PinnaPrison
        never stores the balance; every call delegates to your plugin. Display name/colour come from
        external-currencies.yml (matched by id). Must be THREAD-SAFE (called from Netty mining threads):
          String getId()                                        // e.g. "rivalcredits"
          BigDecimal getBalance(UUID playerId)
          void setBalance(UUID playerId, BigDecimal amount)
          void addBalance(UUID playerId, BigDecimal amount)
          void removeBalance(UUID playerId, BigDecimal amount)

        ----------------------------------------------------------------------------
        EnchantService  (see the ENCHANT SYSTEM section for registerEnchant + onProc)
        ----------------------------------------------------------------------------
        void registerEnchant(String enchantId, APIEnchant enchant)
        Set<String> getEnchantIds()
        boolean exists(String enchantId)
        String getDisplayName(String enchantId)
        BigDecimal getMaxLevel(String enchantId)
        ConfigurationSection getSettings(String enchantId)     // the enchant's settings: block — YOUR custom config values (currency id, amount, animation knobs, ...). null if none. Read it INSIDE onProc so /pinna reload picks up edits.
        String getProcMessage(String enchantId)                // the configured proc-message (raw), or null
        void sendProcMessage(Player player, String enchantId, Object... replacements) // sends proc-message honouring BOTH mute toggles + colours + PAPI + {placeholder},value pairs. The easy, configurable proc message for every API enchant.
        Map<String, BigDecimal> getPlayerEnchants(UUID playerId)
        BigDecimal getLevel(UUID playerId, String enchantId)
        void setLevel(UUID playerId, String enchantId, BigDecimal level)
        void addLevel(UUID playerId, String enchantId, BigDecimal levels)
        void removeLevel(UUID playerId, String enchantId, BigDecimal levels)
        BigDecimal getChance(UUID playerId, String enchantId)   // effective proc chance 0-100 (booster/crystal/prestige aware)
        BigDecimal getCost(UUID playerId, String enchantId, BigDecimal levels)
        BigDecimal getMaxLevelsAffordable(UUID playerId, String enchantId)
        int getPrestige(UUID playerId, String enchantId)
        void setPrestige(UUID playerId, String enchantId, int prestige)
        boolean canPrestige(UUID playerId, String enchantId)
        void prestige(Player player, String enchantId)
        boolean isDisabled(UUID playerId, String enchantId)     // the player's on/off toggle for this enchant
        // ---- the /settings mute toggles: HONOUR ALL OF THEM ----
        boolean isMessagesDisabled(UUID playerId)               // chat (sendProcMessage already checks it)
        boolean isProcMessageDisabled(UUID playerId, String enchantId) // per-enchant message toggle
        boolean isSoundsDisabled(UUID playerId)                 // check PER VIEWER before playSound
        boolean isParticlesDisabled(UUID playerId)              // check PER VIEWER before spawnParticle
        boolean isMobEntitiesDisabled(UUID playerId)            // this viewer opted out of enchant-spawned packet MOBS (zombies, golems, bats, TNT, ModelEngine models). Text/block/item DISPLAYS are never affected. mines.spawnInMine() already applies this for you — only call it when you show an entity by hand.
        void tryProcEnchants(Player player, EnchantData data)   // rolls ALL the player's enchants
        void procEnchant(Player player, String enchantId, EnchantData data) // forces one (no chance roll)

        ----------------------------------------------------------------------------
        LevelingService  (rankup, pickaxelevel, rebirth, ...)
        ----------------------------------------------------------------------------
        Set<String> getLevelingIds()
        boolean exists(String levelingId)
        BigDecimal getLevel(UUID playerId, String levelingId)
        void setLevel(UUID playerId, String levelingId, BigDecimal amount)
        void addLevel(UUID playerId, String levelingId, BigDecimal amount)
        void removeLevel(UUID playerId, String levelingId, BigDecimal amount)
        BigDecimal getCost(UUID playerId, String levelingId, BigDecimal levels)
        BigDecimal getMaxLevelsAffordable(UUID playerId, String levelingId)
        void upgrade(Player player, String levelingId, BigDecimal levels)
        String getProgressBar(UUID playerId, String levelingId)
        float getProgressPercent(UUID playerId, String levelingId)

        ----------------------------------------------------------------------------
        PickaxeService
        ----------------------------------------------------------------------------
        boolean isPickaxe(ItemStack item)
        ItemStack createPickaxe(Player player)
        ItemStack getPickaxe(Player player)
        void givePickaxe(Player player)
        void updatePickaxe(Player player)                       // rebuild lore/enchants in place (main thread)
        int getEfficiency()
        // --- keeping YOUR NBT alive on the pickaxe ---
        // PinnaPrison rebuilds the pickaxe item from its config (a re-give, a skin change, the
        // mine-world tools option handing it out on every entry). A rebuilt item would come back
        // without your data, so declare your top-level NBT keys and snapshot them after writing.
        void registerExternalTag(String nbtKey)                 // e.g. "MYPLUGIN_PERK"; call in onEnable
        void unregisterExternalTag(String nbtKey)
        Set<String> getExternalTags()
        void saveExternalTags(Player player)                    // snapshot the registered keys currently on their pickaxe — call right after you change your NBT. MAIN THREAD (it reads the item)
        void clearExternalTags(UUID playerId)                   // next pickaxe is built clean

        ----------------------------------------------------------------------------
        MineService  (private mines are PACKET-BASED and per-player; one shared void world)
        ----------------------------------------------------------------------------
        World getMinesWorld()
        boolean hasMine(Player player)
        boolean isInMine(Player player)
        void createMine(Player player)
        void regenMine(Player player)
        void expandMine(Player player)
        void shrinkMine(Player player)
        void upgradeMine(Player player)
        boolean canExpand(Player player)
        int getMineSize(Player player)
        Vector getMinCorner(Player player)
        Vector getMaxCorner(Player player)
        String getMineType(Player player)
        Material getBlockAt(Player player, Vector position)     // AIR if mined, null if out of bounds

        // ---- VIRTUAL BLOCK BREAKING ----
        boolean isVirtualBlockBreaking(Player player)
        // Players can turn Virtual Block Breaking on in /settings. While it is on every break method
        // below still pays out EXACTLY as always and still returns the real block count, but the
        // mine's blocks stay standing: no block packets, no depletion, no reset. Your enchant needs
        // no special handling — it just works. Query this ONLY when your addon did something that
        // assumed the blocks really vanished, e.g. lifting your own fake-block disguise.

        // ---- BREAKING + PAYING (the mine the player is STANDING IN) ----
        // These pay the player EXACTLY like mining. Flags:
        //   affectBlockCurrencies = grant rankup/pickaxe xp etc per block   (usually false)
        //   affectAutosell        = collect blocks into backpack / autosell (usually true)
        //   affectTokenGreed      = also pay the Token Greed enchant bonus  (usually true)
        // They only touch the player's OWN joined mine, never the real world. Thread-safe.
        int breakBlocks(Player player, Collection<Vector> positions, boolean affectBlockCurrencies, boolean affectAutosell, boolean affectTokenGreed)
        int breakLayer(Player player, int y, boolean affectBlockCurrencies, boolean affectAutosell, boolean affectTokenGreed)
        int breakSphere(Player player, Vector center, double radius, boolean affectBlockCurrencies, boolean affectAutosell, boolean affectTokenGreed)
        boolean breakBlock(Player player, Vector position, boolean affectBlockCurrencies, boolean affectAutosell, boolean affectTokenGreed, boolean affectEnchants) // affectEnchants=true can chain-proc; use carefully

        // ---- the OWNED mine, even while the owner stands elsewhere (autominer-style) ----
        Material getBlockInOwnMine(Player owner, Vector position) // AIR if mined, null if out of bounds / no mine
        List<Vector> findBlocksNear(Player owner, Vector center, double radius, int limit) // up to limit random unbroken blocks in range (how built-in autominers pick targets); lock-free
        Vector findTopBlock(Player owner)                       // random unbroken block on the highest non-empty layer, or null
        int highestBlockY(Player owner, int x, int z)           // highest non-air Y in that column, Integer.MIN_VALUE if empty/out of bounds
        int getNonAirBlocks(Player owner)                       // unbroken blocks left (0 if unowned)
        int getTotalBlocks(Player owner)                        // total capacity broken+unbroken (0 if unowned)
        int breakBlocksInOwnMine(Player owner, Collection<Vector> positions, boolean affectBlockCurrencies, boolean affectAutosell, boolean affectTokenGreed) // breaks in the OWNED mine even while the owner roams; shows damage to viewers + checks reset threshold. All three flags false = raw break, pay through SellService#sell yourself (what built-in autominers do)

        // ---- VIEWERS + PACKET ENTITIES ----
        Collection<Player> getMineViewers(Player player)        // digger + co-op members + visitors — target ALL packet FX at these
        void spawnInMine(Player player, EdEntity entity)        // show a packet entity to the WHOLE mine + spawn it. USE THIS, never addWatcher+spawn. Honours the mob-entities toggle per viewer.
        void spawnInMine(Player player, EdEntity entity, boolean enchantMob) // enchantMob=false for something that is part of the mine (a decoration, a boss, a shop entity) and must stay visible even for players who muted enchant mobs. The single-arg overload passes true.
        void despawnInMine(Player player, EdEntity entity)      // untrack + despawn. USE THIS, never entity.remove()
        void setEntityEquipment(Player player, EdEntity entity, EntityEquipmentSlot slot, ItemStack item)
        // ^ dresses a spawnInMine entity AND remembers the item, so viewers who arrive later still
        //   see it. EdLib's raw entity.setEquipment only reaches the watchers it had at that instant
        //   and the spawn packet a late viewer gets carries no equipment — inside a mine always use this.

        // ---- FAKE BLOCKS (client-side lies; the mine data is untouched) ----
        List<Vector> disguiseBlocks(Player player, Collection<Vector> positions, Material material)
        // Shows 'material' at every position the mine still has a block at, to every mine viewer.
        // Skips positions outside the mineable area (those read the real shell/schematic) and already
        // broken ones. RETURNS exactly what was disguised — break or reveal those afterwards.
        void revealBlocks(Player player, Collection<Vector> positions)
        // Re-sends each position's REAL current block (AIR where broken). ALWAYS call this at the end
        // of an animation that disguised blocks: after a normal break the chunk resend clears the
        // disguise for free, but under Virtual Block Breaking nothing is broken and no resend happens,
        // so the fake blocks would stay on the client forever. Calling it unconditionally is safe.

        void visit(Player visitor, Player owner)
        void goToOwnMine(Player player)

        ----------------------------------------------------------------------------
        BackpackService  (NO capacity tiers any more: value comes from UPGRADES bought with
        currency and ATTACHMENTS handed out by command and equipped into slots)
        ----------------------------------------------------------------------------
        BigDecimal getSize(UUID playerId)                       // capacity; ZERO = unlimited
        BigDecimal getBlocksMultiplier(UUID playerId)           // total blocks multiplier (1 + every bonus)
        Map<String, BigDecimal> getItems(UUID playerId)         // item id -> amount
        BigDecimal getWeight(UUID playerId)
        BigDecimal addBlocks(Player player, Material material, int count) // store mined blocks (or instantly autosell); returns what actually landed after the multiplier + capacity clamp
        void sell(Player player)
        int getUpgradeLevel(UUID playerId, String upgradeId)
        void setUpgradeLevel(UUID playerId, String upgradeId, int level)
        boolean giveAttachment(UUID playerId, String attachmentId, int tier) // false if unknown id
        int getAttachmentSlots(UUID playerId)
        void setAttachmentSlots(UUID playerId, int slots)
        int fuseAttachments(UUID playerId)                      // fuses every fusable group; returns fusions
        boolean isAutosellEnabled(UUID playerId)
        void setAutosell(UUID playerId, boolean enabled)
        boolean isBackpackItem(ItemStack item)
        ItemStack createBackpackItem(Player player)
        void openGui(Player player)

        ----------------------------------------------------------------------------
        SellService
        ----------------------------------------------------------------------------
        boolean isAutosellEnabled(UUID playerId)
        void setAutosell(UUID playerId, boolean enabled)
        boolean hasPrice(Material material)
        Map<String, BigDecimal> sell(UUID playerId, Material material, BigDecimal amount) // returns per-currency gains (boosters + visitor tax applied)
        void addSummary(UUID playerId, String economyId, BigDecimal amount)     // count a payout YOU made in the reward summary
        void removeSummary(UUID playerId, String economyId, BigDecimal amount)  // take it back (refund / rolled-back payout)

        REWARD SUMMARY — making your own payouts show up
        Selling, per-block currencies and the config \`give-eco\` action all feed the periodic "Reward
        Summary" message, the income rate and the session totals. When YOUR addon pays a player
        directly (an API enchant reward, a custom drop) none of that happens, so the summary reports
        less than the player actually earned. \`addSummary\` closes that gap:
        \`\`\`java
        SellService sell = PinnaPrisonAPI.getInstance().getSell();

        // 1. pay the player           2. count it
        api.getCurrencies().addBalanceBoosted(uuid, "tokens", amount);
        sell.addSummary(uuid, "tokens", amount);
        \`\`\`
        RULES:
        - addSummary ONLY COUNTS — it never pays. Credit the balance yourself (CurrencyService or your
          own economy) as well, or the summary reports income nobody received.
        - Count what the player RECEIVED, not what you configured. \`addBalanceBoosted\` returns the
          boosted figure — pass that one, or the summary under-reports by exactly the boost.
        - The economy id is NOT VALIDATED. A PinnaPrison currency, a leveling id, or an id of your own
          that PinnaPrison knows nothing about ("souls") are all accepted and accumulate under that key.
        - Read it back anywhere placeholders work: %pinnaprison_summary_<id>%, plus
          %pinnaprison_summary_rate_<id>% (last 60s) and %pinnaprison_summary_gained_<id>% (session).
        - A key with NO LINE in \`summary.message\` (autosell.yml) accumulates but is never shown. Tell
          the server owner to add one, and to test the RAW placeholder in the condition — "1.5K" from a
          _formatted placeholder is not a number, so the line would silently drop every time:
            - '[if %pinnaprison_summary_souls% > 0] &d&l+ %pinnaprison_summary_souls_formatted% &5Souls'
        - removeSummary floors the running + session totals at zero and drops a total that reaches zero
          (so its [if ... > 0] line hides itself again). It deliberately leaves the rolling RATE alone:
          that measures gains over a past window a later correction cannot un-happen.
        - Both ignore non-positive amounts and are safe to call from any thread (so straight off an
          async proc thread — no sync hop).

        ----------------------------------------------------------------------------
        BoosterService  (personal + global currency-income / enchant-chance multipliers)
        ----------------------------------------------------------------------------
        boolean isEnabled()
        double getEconomyBoost(UUID playerId, String economy)         // 0 = none
        double getEnchantBoost(UUID playerId)
        void giveBooster(UUID playerId, String id, String economy, double multiplier, boolean enchantBooster, long durationSeconds) // default name "API Booster"; id is what removeBooster expects
        void giveBooster(UUID playerId, String id, String name, String economy, double multiplier, boolean enchantBooster, long durationSeconds) // custom display name (menu/boss bar)
        void removeBooster(UUID playerId, String boosterId)
        void addGlobalBooster(String economy, double multiplier, boolean enchantBooster, long durationSeconds) // 0s = permanent
        List<GlobalBoost> getGlobalBoosters()                         // snapshot of the active server-wide boosters (expired already dropped)
        int removeGlobalBoosters(String economy)                      // a currency/enchant id, "enchants" for the global enchant-chance boost, or "all"; returns how many stopped
        void registerBoostProvider(String id, BoostProvider provider) // live computed boosts, never persisted — gone the moment you unregister or return 0
        void unregisterBoostProvider(String id)
        GlobalBoost record (iapi.booster): (String name, String economy, double multiplier,
          boolean enchantBooster, long endTimeMillis) + boolean isPermanent(), long timeLeftMillis()
        BoostProvider (es.edwardbelt.pinnaprison.iapi.booster) — conditional bonuses ("while holding a
        streak", "while an event runs"). Stacks with regular boosters per boosters.yml and applies even
        while the boosters feature itself is disabled. Queried on EVERY boosted income + proc-chance
        lookup (hot async mining path): must be FAST (cached map lookups, no I/O) and thread-safe.
        All methods default:
          double getEconomyBoost(UUID playerId, String economy)  // extra above 1x, 0 = none; currency id = income, enchant id = that enchant's proc chance
          double getEnchantBoost(UUID playerId)                  // extra above 1x on every enchant's proc chance
          Collection<ProviderBoost> getBoostViews(UUID playerId, String economy) // display-only entries for the boosters GUI / %pinnaprison_boosters_names_<economy>%; empty = invisible (boost still applies)
          Collection<ProviderBoost> getEnchantBoostViews(UUID playerId)
        ProviderBoost record: (String displayName, double displayMultiplier) // +50% passes 1.5 (renders "1.5x")
        boolean isBoosterItem(ItemStack item)
        String getBoosterId(ItemStack item)
        ItemStack createBoosterItem(String id)
        void claim(Player player, ItemStack boosterItem)

        ----------------------------------------------------------------------------
        CrystalService  (pickaxe crystals = per-key multipliers)
        ----------------------------------------------------------------------------
        double getMultiplier(UUID playerId, String key)         // key = a currency id, an enchant id, or "all-enchants"
        int getSlots(UUID playerId)
        void setSlots(UUID playerId, int slots)
        void addSlots(UUID playerId, int amount)
        void removeSlots(UUID playerId, int amount)
        boolean isCrystalItem(ItemStack item)
        ItemStack createCrystalItem(String id)
        CrystalInfo getCrystalData(ItemStack item)              // the item's rolled values, or null if not a crystal
        void apply(Player player, ItemStack crystalItem)        // rolls the apply chance
        void apply(Player player, ItemStack crystalItem, boolean skipRoll) // skipRoll=true always applies (slot + duplicate-boost checks still run); one crystal consumed either way
        List<AppliedCrystal> getAppliedCrystals(UUID playerId)
        List<String> getCrystalIds()                            // every crystal configured in crystals.yml (items)
        CrystalType getCrystalType(String id)                   // what it boosts + the ranges it rolls in, or null
        ItemStack createCrystalItem(String id, Integer chance, Integer multiplier) // exact values; null on either = roll it from config
        ItemStack createCrystalItemForBoost(String boost, int chance, int multiplier) // by boost key instead of crystal id
        ItemStack createRandomCrystalItem(Collection<String> ids, int minChance, int maxChance, int minMultiplier, int maxMultiplier)
        ItemStack createRandomCrystalItem(int minChance, int maxChance, int minMultiplier, int maxMultiplier)  // every configured crystal
        boolean storeCrystal(Player player, ItemStack crystalItem) // into the crystal MENU instead of the hand; false if full/filtered
        CrystalType record (iapi.data):    (String id, String boost, int minChance, int maxChance, int minMultiplier, int maxMultiplier)
        CrystalInfo record (iapi.data):    (String id, int multiplier, int chance)   // 25 = +25%
        AppliedCrystal record (iapi.data): (UUID uuid, String id, int multiplier)    // uuid = removable instance id

        // ---- TIERED CRYSTAL BOXES / CRATES (choose the values yourself) ----
        // createCrystalItem(id) rolls the crystal's OWN configured ranges. To decide the values
        // (a T1 box that rolls low, a T5 box that rolls high) pass them in. Bounds are inclusive,
        // and a max <= its min is a fixed value. The result is a normal crystal item — the player
        // applies, stores, fuses and dusts it like any other.
        \`\`\`java
        CrystalService crystals = PinnaPrisonAPI.getInstance().getCrystals();

        // one random crystal, chance 40-60%, boost +5% to +15%
        ItemStack t1 = crystals.createRandomCrystalItem(40, 60, 5, 15);

        // ...restricted to enchant crystals only (boost() is a currency id, an enchant id or "all-enchants")
        Set<String> enchantIds = PinnaPrisonAPI.getInstance().getEnchants().getEnchantIds();
        List<String> enchantCrystals = crystals.getCrystalIds().stream()
                .filter(id -> enchantIds.contains(crystals.getCrystalType(id).boost()))
                .toList();
        ItemStack t5 = crystals.createRandomCrystalItem(enchantCrystals, 90, 100, 40, 60);

        // exact values on one configured crystal (null on either = roll that one as configured)
        ItemStack fixed = crystals.createCrystalItem("token_crystal", 100, 25);

        player.getInventory().addItem(t1);   // or hand it straight to the crystal menu:
        crystals.storeCrystal(player, t5);   // false when the storage is full or the boost is filtered
        \`\`\`

        ----------------------------------------------------------------------------
        RebirthService
        ----------------------------------------------------------------------------
        BigDecimal getRebirths(UUID playerId)
        BigDecimal getRequiredAmount(UUID playerId)
        BigDecimal getRequiredCost(UUID playerId)
        BigDecimal getPointsPerRebirth()
        void rebirth(Player player)
        Set<String> getUpgradeIds()
        int getUpgradeLevel(UUID playerId, String upgradeId)
        void purchaseUpgrade(Player player, String upgradeId)
        double getEconomyBoost(UUID playerId, String currencyId)
        double getEnchantBoost(UUID playerId)

        ----------------------------------------------------------------------------
        AttributeService
        ----------------------------------------------------------------------------
        int getLevel(UUID playerId)
        double getEconomyBoost(UUID playerId, String currencyId)
        double getEnchantBoost(UUID playerId)

        ----------------------------------------------------------------------------
        AbilityService
        ----------------------------------------------------------------------------
        boolean exists(String abilityId)
        boolean isUnlocked(UUID playerId, String abilityId)
        void unlock(Player player, String abilityId)
        String getSelectedId(UUID playerId)
        boolean isSelected(UUID playerId, String abilityId)
        void toggleSelect(Player player, String abilityId)
        boolean isAutoCast(UUID playerId)
        void setAutoCast(UUID playerId, boolean value)
        long getCooldownRemaining(UUID playerId, String abilityId)   // millis, 0 = ready
        void activateSelected(Player player, boolean auto)
        void activateSelected(Player player, boolean auto, boolean ignoreCooldown) // ignoreCooldown=true fires even mid-cooldown — what a "proc your ability for free" enchant needs (the cooldown restarts either way)
        void reduceCooldown(UUID playerId, String abilityId, long millis) // takes millis off the remaining cooldown, floored at ready
        boolean isAbilityItem(ItemStack item)
        ItemStack createAbilityItem(String abilityId)
        void applyItem(Player player, ItemStack abilityItem)

        ----------------------------------------------------------------------------
        AutominerService
        ----------------------------------------------------------------------------
        int getMaxMiners()
        Set<String> getEnchantIds()
        int getUnlockedSlots(UUID playerId)
        void addSlots(UUID playerId, int amount)
        boolean isSlotUnlocked(UUID playerId, String minerId)
        double getBattery(UUID playerId)                        // seconds of runtime left
        void addBattery(UUID playerId, double amount)
        int getEnchantLevel(UUID playerId, String minerId, String enchantId)
        BigDecimal getUpgradeCost(UUID playerId, String minerId, String enchantId, int levels)
        int getMaxLevelsAffordable(UUID playerId, String minerId, String enchantId)
        void upgradeEnchant(Player player, String minerId, String enchantId, int levels, boolean max)
        boolean isSummoned(UUID playerId, String minerId)
        void summon(Player player, String minerId)
        void despawn(Player player, String minerId)

        ----------------------------------------------------------------------------
        BombService / DrillService
        ----------------------------------------------------------------------------
        boolean isEnabled()
        boolean isBombItem(ItemStack item)   / boolean isDrillItem(ItemStack item)
        String getBombId(ItemStack item)     / String getDrillId(ItemStack item)
        ItemStack createBombItem(String id)  / ItemStack createDrillItem(String id)
        void throwBomb(Player player, ItemStack bombItem)  / void useDrill(Player player, ItemStack drillItem)

        ----------------------------------------------------------------------------
        PowerupService  (Mine Powerups: owner-only floating heads granting a rolled temporary
        boost when the mine OWNER walks over them — privatemines/powerups/<id>.yml)
        ----------------------------------------------------------------------------
        Set<String> getPowerupIds()                             // the file names in privatemines/powerups/
        List<PowerupView> getActivePowerups(Player owner)       // what is floating in their mine right now
        boolean spawnPowerup(Player owner, String powerupId)    // force-spawn ignoring the per-mine cap; fires PowerupSpawnEvent. Any thread
        boolean spawnPowerup(Player owner, String powerupId, Location location) // same, at an exact spot (null = random top spot)
        int claimPowerups(Player owner)                         // claim every live powerup as if walked over (autoClaimed=true); returns the count
        int despawnPowerups(Player owner)                       // remove them all with no boost/actions; returns the count
        PowerupView (es.edwardbelt.pinnaprison.iapi.powerup) — all getters thread-safe:
          String getId(); String getName(); boolean hasBoost();
          String getBoostEconomy()        // currency id or enchant id; empty for the global enchant boost
          boolean isEnchantBoost()        // true for type: enchants (global enchant-chance boost)
          double getMultiplier()          // the ROLLED bonus above 1x (0.85 = +85%); final unless a claim listener retunes it
          long getBoostDurationSeconds()  // 0 = permanent
          Location getLocation(); long getSecondsUntilDespawn(); boolean isFinished();
          boolean claim()                 // claim for the owner now (fires PowerupClaimEvent, autoClaimed=true); any thread

        ----------------------------------------------------------------------------
        GangService  (gang lookup + full lifecycle. Mutators bypass the /gang command's
        player-facing checks — create requirements, permissions, invites — and fire the events)
        ----------------------------------------------------------------------------
        Optional<GangView> getGang(UUID gangId)
        Optional<GangView> getGangByName(String name)
        Optional<GangView> getPlayerGang(UUID playerId)
        boolean hasGang(UUID playerId)
        List<GangView> getAllGangs()
        List<GangView> getTopGangs()                            // ranked by gang level, same order as /gang top
        int getRank(UUID gangId)                                // 1-based leaderboard rank, -1 if unranked
        boolean gangNameExists(String name)
        Optional<GangView> createGang(UUID leaderId, String leaderName, String name) // empty if already in a gang / name taken / cancelled
        boolean disbandGang(UUID gangId)
        boolean addMember(UUID gangId, UUID playerId, String playerName)
        boolean removeMember(UUID gangId, UUID playerId)
        boolean transferLeader(UUID gangId, UUID newLeaderId)
        boolean setDescription(UUID gangId, String description)
        BigDecimal getPoints(UUID gangId)
        void addPoints(UUID gangId, BigDecimal amount)
        boolean removePoints(UUID gangId, BigDecimal amount)
        BigDecimal addExperience(UUID gangId, BigDecimal amount) // handles level-ups; returns the new level
        Set<String> getUpgradeIds()
        int getUpgradeLevel(UUID gangId, String upgradeId)
        boolean setUpgradeLevel(UUID gangId, String upgradeId, int level) // forces, ignoring point cost
        double getGangMultiplier(UUID playerId, String currencyId) // combined gang-upgrade income bonus above 1.0 (0 = no gang / no upgrade)
        int getMaxMembers()                                     // base cap from gangs/config.yml
        int getMaxMembers(UUID gangId)                          // base + every members-per-level upgrade that gang bought
        GangView (es.edwardbelt.pinnaprison.iapi.gang) — read-only LIVE view; mutate through the service:
          UUID getId(); String getName(); String getDescription(); UUID getLeader();
          Set<UUID> getMemberIds() (includes leader); int getMemberCount(); BigDecimal getLevel();
          BigDecimal getExperience(); BigDecimal getPoints(); int getUpgradeLevel(String upgradeId);
          boolean isMember(UUID playerId); boolean isLeader(UUID playerId)

        ----------------------------------------------------------------------------
        PickaxeSkinService  (configured skins pickaxe/skins/*.yml + per-player owned/selected —
        build your own unlock mechanics on top of the built-in visuals)
        ----------------------------------------------------------------------------
        List<String> getSkinIds()                               // config order; first = free default
        PickaxeSkinInfo getSkin(String skinId)                  // null if unknown; snapshot — refetch after reload
        String getDefaultSkinId()
        String getSelectedSkinId(UUID playerId)                 // falls back to the default skin id
        List<String> getOwnedSkinIds(UUID playerId)
        boolean isSkinOwned(UUID playerId, String skinId)       // default skin always owned
        boolean grantSkin(UUID playerId, String skinId)         // free grant, ignores sequential unlock order; thread-safe; does NOT equip
        boolean revokeSkin(UUID playerId, String skinId)        // default skin can't be revoked; if equipped, selection resets
        void selectSkin(Player player, String skinId)           // equips: persists + rebuilds the pickaxe + plays the equip sound. MAIN THREAD only
        Reads + grant/revoke are thread-safe (fine inside async BlockMineEvent listeners).
        PickaxeSkinInfo (es.edwardbelt.pinnaprison.iapi.data): String getId()/getName()/getPrimaryColor()/
          getSecondaryColor()/getMaterial(); int getModelData() (-1 = none); double getMultiplier() (extra
          blocks per mined block, 0.4 = +40%, stacks with the backpack multiplier);
          double getCurrencyMultiplier(String currencyId) (the skin's multipliers: section — additive
          income bonus, 0 if none; the reserved backpack_blocks key is getMultiplier(), not a currency);
          String getCostCurrency() (null = no built-in cost); BigDecimal getCostAmount() (never null)
        To intercept the built-in money purchase (pickaxe-skins GUI) listen to PickaxeSkinPurchaseEvent.

        ----------------------------------------------------------------------------
        PlayerDataService  (read/edit ANY player's stored data — OFFLINE included; for panels/bots)
        ----------------------------------------------------------------------------
        PlayerData getData(UUID playerId)                       // null if not in memory — ensureLoaded first for offline players
        boolean hasData(UUID playerId)                          // in memory OR on disk/database
        boolean isLoaded(UUID playerId)
        boolean ensureLoaded(UUID playerId)                     // loads offline data into memory; may block — OFF the main thread
        UUID getCurrentMineOwner(UUID onlinePlayerId)           // owner of the mine the ONLINE player stands in, or null. Main thread
        boolean editEconomy(UUID playerId, String kind, String dataId, String op, BigDecimal amount)
          // kind: "currency"|"leveling"|"enchant"; op: "set"|"add"|"remove". RAW admin override: no events,
          // no boosts, works online or offline, persists async. false only if the player never joined. Off main thread
        Collection<PlayerData> getAllData()                     // every stored player incl. offline (leaderboards/exports). HEAVY — off main thread + cache. Empty when the backend can't enumerate (Mongo)
        PlayerData (es.edwardbelt.pinnaprison.iapi.data) — read view; maps hold STORED entries only (absent
        id = default/zero): UUID getUniqueId(); BigDecimal getRawBlocksBroken() (lifetime hand-mined);
          Map<String,BigDecimal> getCurrencies()/getLevelings()/getEnchants();
          Map<String,Integer> getEnchantPrestiges() (may be null on old saves); String getMineType()/getMineTier();
          int getMineExpansions(); double getMineTax() (0-100); boolean isMineOpen()

        ----------------------------------------------------------------------------
        VariableService  (named reusable values — variables.yml + %pinnaprison_variable_<name>%)
        ----------------------------------------------------------------------------
        Two kinds (VariableType). STATIC = a global template resolved from PlaceholderAPI for the
        reading player (a constant with no placeholders is resolved once and cached; dynamic ones can
        opt into a short per-player cache-millis). CHANGEABLE = a per-player value stored in player
        data, starting at the config default. All methods thread-safe.
        boolean exists(String name)
        boolean isStatic(String name) / boolean isChangeable(String name)
        VariableType getType(String name)                       // STATIC | CHANGEABLE, null if unknown
        VariableInfo getInfo(String name)                       // null if unknown
        Set<String> getVariableNames()                          // configured + addon-registered
        String getValue(Player player, String name)             // "" if unknown; player may be null
        String getValue(UUID playerId, String name)
        String get(UUID playerId, String name)                  // stored-or-default RAW value of a changeable
        void set(UUID playerId, String name, String value)      // no-op unless it's a changeable
        BigDecimal add(UUID playerId, String name, BigDecimal amount) // numeric changeables; returns the new value
        void reset(UUID playerId, String name)                  // back to the config default
        void registerStatic(String name, Function<Player, String> supplier) // a live computed variable with no config entry; survives reloads until unregister. Must be fast + side-effect free (called from async placeholder threads)
        void unregister(String name)                            // addon-registered only; config variables untouched
        VariableInfo record (iapi.data): (String name, VariableType type, boolean numeric, String raw)

        ----------------------------------------------------------------------------
        PlaceableService  (register custom mine placeable types — packet-based decorations /
        interactables configured per mine type under placeables: in privatemines/mines/<type>.yml;
        the section's type: key picks the implementation. Built-ins: hologram, entity, afk-block.
        Register in onEnable — mines load per player join, after all plugins enabled)
        ----------------------------------------------------------------------------
        void registerPlaceableType(String typeId, PlaceableFactory factory) // re-registering replaces (built-ins included)
        boolean isPlaceableTypeRegistered(String typeId)
        void registerClickable(int entityId, PlaceableClickHandler handler) // route clicks on a packet entity by edEntity.getId(); ids are server-global
        void unregisterClickable(int entityId)                  // ALWAYS call from APIPlaceable#destroy()
        PlaceableFactory (es.edwardbelt.pinnaprison.iapi.placeable, functional):
          APIPlaceable create(Player mineOwner, ConfigurationSection section) // once per loaded mine, possibly async; section = the placeable's yml entry (type + your keys: position, model ids, ...); null/throw = skip (logged)
        APIPlaceable — one instance per loaded mine; packet-based, so show/hide is per watcher. All three
        may run OFF the main thread (EdLib packet ops are safe there, Bukkit API is not):
          void place(Player watcher)   // show to a viewer (called for existing + future mine viewers) — typically entity.addWatcher(watcher)
          void unplace(Player watcher) // hide from a viewer who left
          default void destroy()       // release packet entities + unregister clickables (mine reload/teardown)
        PlaceableClickHandler (functional): void onClick(Player player, PlaceableClickType clickType)
          // Netty thread, vanilla double-fire already de-duplicated; schedule a sync task before Bukkit API
        PlaceableClickType enum: LEFT, RIGHT

        ----------------------------------------------------------------------------
        DisplayService  (PinnaPrison refreshes a persistent leveling action bar every couple of
        ticks, so action-bar text you send yourself is overwritten almost immediately — route it
        through this instead)
        ----------------------------------------------------------------------------
        void showActionbar(Player player, String text, long durationTicks) // one-shot message, suppresses the bar + overrides for that window; colours translated; any thread
        void registerActionbarOverride(String id, Function<Player, String> provider)
          // persistent override: while provider returns non-null for a player, its text replaces the leveling
          // bar, refreshed by PinnaPrison's own loop (no flicker). Provider runs ASYNC every few ticks for
          // EVERY online player — must be thread-safe + cheap: return a cached, pre-formatted string (legacy
          // colour codes, hex already translated). Return null to fall through. Same id re-register replaces;
          // the first registered provider returning non-null wins. Temporary showActionbar messages win over overrides
        void unregisterActionbarOverride(String id)
        String id = your plugin name.

        ----------------------------------------------------------------------------
        FormatService  (format/parse numbers with the server's format.yml notation so addon output
        matches PinnaPrison's own lore/placeholders/menus. Suffixes config-driven: k, M, B, T, Qa,
        Qi, S, Sp, O, N, D, ... up to 10^102. All thread-safe)
        ----------------------------------------------------------------------------
        String format(BigDecimal number)                        // server default notation (abbreviated or pretty)
        String formatAbbreviated(BigDecimal number)             // 100000 -> "100k", 2.5B, 100D
        String formatGrouped(BigDecimal number)                 // 100000 -> "100,000"
        BigDecimal parse(String input)                          // "100M" / "2.5B" / "1,000" / scientific -> number; null if invalid. Case-insensitive, inverse of formatAbbreviated

        ----------------------------------------------------------------------------
        GuiService (es.edwardbelt.pinnaprison.iapi.gui)  (PinnaPrison's config-driven GUI system
        guis/*.yml — register your own custom-item types and reference them from any GUI config)
        ----------------------------------------------------------------------------
        void registerItemType(String typeId, ApiGuiItemFactory factory) // typeId = the custom-item.type value; built-in ids win on collision; re-register replaces
        void unregisterItemType(String typeId)
        boolean guiExists(String guiId)                         // guis/<id>.yml loaded?
        void openGui(Player player, String guiId)               // main-thread hop included
        void openGui(Player player, String guiId, Map<String, String> placeholders) // extra {token} replacements for every item
        void refreshOpenGui(Player player)                      // fully re-render the open PinnaPrison GUI (after your item changed state)
        String getOpenGuiId(Player player)                      // null if none
        ApiGuiItemFactory (functional): ApiGuiItem create(ApiGuiItemContext context) // main thread, once per configured slot per render — keep cheap
        ApiGuiItem — controls one slot (all callbacks main thread):
          ItemStack render()                                    // null hides the entry (the filler shows)
          default void onClick(ApiGuiClick click)               // click itself always cancelled; mutate inventory/cursor NEXT tick
          default boolean allowsCursorInteraction()             // true = viewer can pick/place in their OWN inventory (drag-and-drop slots; read the cursor via click.getCursor()); the top window stays protected
          default boolean shouldShow()                          // false hides (on top of the config requirement)
        ApiGuiItemContext: Player getPlayer(); Map<String,String> getPlaceholders() (live {token} map);
          ConfigurationSection getCustomItemSection();
          ItemStack renderConfiguredItem(Map<String,String> extraPlaceholders)  // renders the yml entry's own item (material/texture-heads, name, lore, model-data, glow, {token} + PAPI + hex)
          ItemStack renderItemSection(ConfigurationSection itemSection, Map<String,String> extraPlaceholders) // render any section in PinnaPrison's item format (e.g. a locked-item: sub-section); null if no material
        ApiGuiClick: Player getPlayer(); ClickType getClickType(); int getSlot(); ItemStack getCursor() (snapshot, null/AIR = empty); ItemStack getClickedItem()
        Reference from a gui yml entry:
          my-slot-1:
            custom-item: { type: 'my-slot', index: 1 }
            slot: 30

        ============================================================================
        EVENTS (es.edwardbelt.pinnaprison.iapi.event)
        ============================================================================
        Base classes:
        PinnaPrisonEvent (abstract extends org.bukkit.event.Event) — auto async-detected. If
          isAsynchronous() is true, DO NOT touch the Bukkit world/entities in the listener; schedule a task.
        PinnaPlayerEvent (abstract extends PinnaPrisonEvent) — Player getPlayer(), UUID getPlayerId()
        Every event has the usual static HandlerList getHandlerList() and HandlerList getHandlers(),
        plus a static hasListeners() helper.

        BlockMineEvent (Cancellable) — a single block dug in a mine, before removal/rewards (async:
          the Netty mining thread for manual swings, the AFK-block timer thread for AFK breaks)
          Vector getPosition(), Material getMaterial(), boolean isAfkBlock()
          // cancel = skip the block and all its rewards (a cancelled manual break also restores it client-side)
        EnchantProcEvent (Cancellable) — an enchant procs, before its effect (async)
          String getEnchantId(), EnchantData getData(), boolean isAfkBlock()  // cancel = skip the effect
        EnchantPrestigeEvent — String getEnchantId(), int getNewPrestige()
        BlocksBrokenEvent — after a bulk break paid out (usually async)
          enum Source { ENCHANT, BOMB, DRILL, AUTOMINER, OTHER }; Source getSource(), String getSourceId(), int getBlocksBroken()
        BombThrowEvent (Cancellable) — String getBombId()
        BombExplodeEvent — String getBombId(), Vector getCenter(), int getBlocksBroken()
        DrillUseEvent (Cancellable) — String getDrillId()
        DrillFinishEvent — String getDrillId(), int getBlocksBroken(), int getLayers()
        CurrencyChangeEvent (Cancellable) — a balance change (add/remove/set), often async
          enum Type { ADD, REMOVE, SET }; UUID getPlayerId(), String getCurrencyId(), Type getType(),
          BigDecimal getPreviousBalance(), BigDecimal getAmount(), void setAmount(BigDecimal) // amount is rewritable
        LevelUpEvent — String getLevelingId(), BigDecimal getFromLevel(), getToLevel(), getLevelsGained()
        PlayerRebirthEvent (Cancellable) — BigDecimal getNewRebirthCount(), getPointsAwarded()
        PrivateMineResetEvent — UUID getOwnerId(), String getMineConfigId(), int getTotalBlocks()
        BackpackSellEvent — BigDecimal getItemsSold(), Map<String,BigDecimal> getGains()
        AbilityActivateEvent (Cancellable) — String getAbilityId(), boolean isAutoCast()
        BoosterActivateEvent (Cancellable) — String getEconomy(), boolean isEnchantBooster(), double getMultiplier(), long getDurationMillis()
        PickaxeSkinPurchaseEvent (Cancellable, PinnaPlayerEvent) — the built-in money purchase in the
          pickaxe-skins GUI (cancel to run your own unlock flow); String getSkinId(), String getCurrency(), BigDecimal getAmount()

        Powerup events (PinnaPlayerEvent; the player is always the MINE OWNER — powerups are owner-only):
        PowerupSpawnEvent (Cancellable) — a powerup is about to materialise, right after its multiplier
          was rolled. Usually async (the interval spawner is an async timer).
          String getPowerupId(), String getPowerupName(), boolean hasBoost(), String getBoostEconomy(),
          boolean isEnchantBoost(), Location getLocation() (a copy),
          double getMultiplier() / void setMultiplier(double)          // retune the roll ("Lucky Roll" perk)
          long getDurationSeconds() / void setDurationSeconds(long)
          boolean isAutoClaim()  / void setAutoClaim(boolean)          // true = claimed for the owner instantly, no head shown ("Auto Claim" perk)
        PowerupClaimEvent (Cancellable) — right before the boost is granted and actions-on-claim run.
          Main thread for walk-over claims; the calling thread for API/auto claims.
          Same getters plus boolean isAutoClaimed(); setMultiplier / setDurationSeconds retune the boost
          before it lands (a "Double Boost" perk is one setMultiplier call).
        PowerupDespawnEvent — a powerup timed out unclaimed (not fired for claims/forced removals). Async.
          String getPowerupId(), String getPowerupName(), Location getLocation()

        Gang events — GangEvent (abstract base, extends PinnaPrisonEvent): UUID getGangId(), String getGangName().
        All below extend GangEvent except GangCreateEvent (no gang exists yet — extends PinnaPrisonEvent directly):
        GangCreateEvent (Cancellable) — UUID getCreatorId(), String getCreatorName(), String getGangName()
        GangDisbandEvent (Cancellable) — UUID getLeaderId()
        GangInviteEvent (Cancellable) — UUID getInviterId(), UUID getTargetId()
        GangJoinEvent (Cancellable) — UUID getPlayerId()
        GangLeaveEvent — UUID getPlayerId()
        GangKickEvent (Cancellable) — UUID getTargetId()
        GangTransferEvent (Cancellable) — UUID getOldLeaderId(), UUID getNewLeaderId()
        GangLevelUpEvent — BigDecimal getFromLevel(), getToLevel(), getLevelsGained()
        GangPointsChangeEvent — BigDecimal getOldPoints(), getNewPoints(), getDelta()
        GangUpgradePurchaseEvent (Cancellable) — UUID getPlayerId(), String getUpgradeId(), int getNewLevel()
        GangChallengeCompleteEvent — UUID getPlayerId(), String getChallengeId(), BigDecimal getPointsAwarded()

        ============================================================================
        ENCHANT SYSTEM — the main reason to use this API
        ============================================================================
        A custom enchant has TWO parts:
        1) BEHAVIOUR (your Java): implement APIEnchant#onProc and register it.
        2) CONFIG (a yaml file): plugins/PinnaPrison/enchants/<id>.yml with type: api — this defines
           chance, level, cost, prestige, display name, material, requirement, cooldown and your own
           settings: block. WITHOUT this file the enchant does not exist in-game (it can't be bought
           and never rolls a chance).

        APIEnchant interface: es.edwardbelt.pinnaprison.iapi.enchant
        void onProc(Player player, EnchantData data)   // runs when the enchant procs
        default boolean asyncSafe()                     // default false — ALWAYS override it to true for a mine enchant
          - false (default): onProc is dispatched to the MAIN thread. Only use this if it touches the
            Bukkit world, real entities or inventories.
          - true: onProc runs on the async break thread (max throughput). Correct whenever onProc does
            purely packet/data work: the MineService break methods, EdLib packet entities, currency
            changes, per-player particles/sounds. This is what every animated mine enchant should use.

        EnchantData interface: es.edwardbelt.pinnaprison.iapi.enchant.data — the trigger context.
          default String getChainSource()                    // the enchant id that chain-triggered this proc, or null for a normal proc
          default Map<String,String> getChainVariables()     // variables the chain source exposed (e.g. "amount" from a greed enchant); empty for normal procs
        BlockBreakEnchantData class (implements EnchantData): the normal mining trigger.
          Vector getPosition()   // the mined block position (mine-world block coords)
          Material getMaterial() // the mined block type
          boolean isAfkBlock()   // true when this break came from the player's AFK block session, not a manual swing
          BlockBreakEnchantData chained(String source, Map<String,String> variables) // a copy tagged as a chained proc
        Always start onProc with: if (!(data instanceof BlockBreakEnchantData hit)) return;

        CHAINING (combo enchants): any enchant's yaml can carry \`chain: <sourceEnchantId>\` (or
        \`chain: { enchant: <id> }\`). A chained enchant no longer procs on block breaks — instead its
        own chance is rolled every time the source enchant procs, and it receives an EnchantData whose
        getChainSource() is the source id and whose getChainVariables() carry what the source exposed.
        Your API enchant needs no code for this; it just works. Read getChainVariables() if you want
        to scale off the source's payout.

        EnchantRegions (es.edwardbelt.pinnaprison.iapi.enchant.EnchantRegions) — pure-math block sets,
        thread-safe, feed them to MineService#breakBlocks:
        static Set<Vector> sphere(Vector center, double radius)
        static Set<Vector> disc(Vector center, double radius, int halfHeight)
        static List<Vector> cuboid(Vector corner1, Vector corner2)

        Register your enchants in onEnable (after PinnaPrison enabled):
        \`\`\`java
        @Override public void onEnable() {
            PinnaPrisonAPI api = PinnaPrisonAPI.getInstance();
            if (api == null) { getLogger().severe("PinnaPrison not enabled!"); return; }
            api.getEnchants().registerEnchant("explosion", new ExplosionEnchant());
            api.getEnchants().registerEnchant("comet", new CometEnchant());
        }
        \`\`\`
        Registration survives /pinna reload (the yaml is re-read each time).

        ----------------------------------------------------------------------------
        THE FX HELPER — copy this class into every addon you write
        ----------------------------------------------------------------------------
        Particles and sounds are per-player packets: they must be sent to every mine viewer, each
        one gated on their own /settings toggle, and they are safe to send from the async proc
        thread. Never write a bare player.spawnParticle in an enchant — go through a helper like
        this so no toggle is ever forgotten.
        \`\`\`java
        package com.example.util;

        import es.edwardbelt.pinnaprison.iapi.PinnaPrisonAPI;
        import es.edwardbelt.pinnaprison.iapi.service.EnchantService;
        import es.edwardbelt.pinnaprison.iapi.service.MineService;
        import org.bukkit.Color;
        import org.bukkit.Location;
        import org.bukkit.Particle;
        import org.bukkit.Sound;
        import org.bukkit.World;
        import org.bukkit.entity.Player;
        import org.bukkit.util.Vector;

        /** Per-viewer, toggle-aware, fully async FX for mine enchants. */
        public final class Fx {

            private Fx() {}

            private static MineService mines()      { return PinnaPrisonAPI.getInstance().getMines(); }
            private static EnchantService enchants() { return PinnaPrisonAPI.getInstance().getEnchants(); }

            /** The digger + co-op members + visitors of the mine the player is in. */
            public static Iterable<Player> audience(Player player) {
                return mines().getMineViewers(player);
            }

            /** A block position turned into the centre of that block, in the mines world. */
            public static Location at(World world, Vector pos) {
                return new Location(world, pos.getX(), pos.getY(), pos.getZ());
            }
            public static Vector center(Vector blockPos) {
                return new Vector(blockPos.getBlockX() + 0.5, blockPos.getBlockY() + 0.5, blockPos.getBlockZ() + 0.5);
            }

            /** Particles to every mine viewer who has NOT muted particles. Safe on any thread. */
            public static void particle(Player player, World world, Particle particle, Vector pos,
                                        int count, double spread, double speed) {
                Location location = at(world, pos);
                for (Player viewer : audience(player)) {
                    if (!viewer.isOnline()) continue;
                    if (enchants().isParticlesDisabled(viewer.getUniqueId())) continue;   // RULE 4
                    viewer.spawnParticle(particle, location, count, spread, spread, spread, speed);
                }
            }

            /** Coloured dust particles (a trail colour read from the enchant's settings). */
            public static void dust(Player player, World world, Vector pos, Color color, float size, int count, double spread) {
                Location location = at(world, pos);
                Particle.DustOptions options = new Particle.DustOptions(color, size);
                for (Player viewer : audience(player)) {
                    if (!viewer.isOnline()) continue;
                    if (enchants().isParticlesDisabled(viewer.getUniqueId())) continue;
                    viewer.spawnParticle(Particle.REDSTONE, location, count, spread, spread, spread, 0, options);
                }
            }

            /** A straight particle line — great for beams/lasers between two points. */
            public static void line(Player player, World world, Vector from, Vector to, Particle particle, double step) {
                Vector delta = to.clone().subtract(from);
                double length = delta.length();
                if (length < 1.0E-4) return;
                Vector unit = delta.multiply(1 / length);
                for (double d = 0; d <= length; d += step) {
                    particle(player, world, particle, from.clone().add(unit.clone().multiply(d)), 1, 0, 0);
                }
            }

            /** Sound to every mine viewer who has NOT muted sounds. Safe on any thread. */
            public static void sound(Player player, World world, Sound sound, Vector pos, float volume, float pitch) {
                Location location = at(world, pos);
                for (Player viewer : audience(player)) {
                    if (!viewer.isOnline()) continue;
                    if (enchants().isSoundsDisabled(viewer.getUniqueId())) continue;      // RULE 4
                    viewer.playSound(location, sound, volume, pitch);
                }
            }
        }
        \`\`\`

        ----------------------------------------------------------------------------
        EXAMPLE 1 — Explosion (simple, packet-only, asyncSafe, fully config-driven)
        ----------------------------------------------------------------------------
        \`\`\`java
        package com.example.enchants;

        import com.example.util.Fx;
        import es.edwardbelt.pinnaprison.iapi.PinnaPrisonAPI;
        import es.edwardbelt.pinnaprison.iapi.enchant.APIEnchant;
        import es.edwardbelt.pinnaprison.iapi.enchant.data.BlockBreakEnchantData;
        import es.edwardbelt.pinnaprison.iapi.enchant.data.EnchantData;
        import es.edwardbelt.pinnaprison.iapi.service.EnchantService;
        import es.edwardbelt.pinnaprison.iapi.service.MineService;
        import org.bukkit.Particle;
        import org.bukkit.Sound;
        import org.bukkit.World;
        import org.bukkit.configuration.ConfigurationSection;
        import org.bukkit.entity.Player;
        import org.bukkit.util.Vector;

        public class ExplosionEnchant implements APIEnchant {

            private static final String ID = "explosion";

            @Override public boolean asyncSafe() { return true; } // packets + data only — RULE 1

            @Override
            public void onProc(Player player, EnchantData data) {
                if (!(data instanceof BlockBreakEnchantData hit)) return;

                PinnaPrisonAPI api = PinnaPrisonAPI.getInstance();
                MineService mines = api.getMines();
                EnchantService enchants = api.getEnchants();
                World world = mines.getMinesWorld();
                Vector center = Fx.center(hit.getPosition());

                // RULE 7: everything tunable comes from settings:, read fresh so /pinna reload applies.
                ConfigurationSection settings = enchants.getSettings(ID);
                double radius        = settings == null ? 3    : settings.getDouble("radius", 3);
                boolean blockCurr    = settings == null ? false : settings.getBoolean("affect-block-currencies", false);
                boolean autosell     = settings == null ? true  : settings.getBoolean("affect-autosell", true);
                boolean tokenGreed   = settings == null ? true  : settings.getBoolean("affect-tokengreed", true);

                // Scale with the level, again from config (RULE 7).
                double perLevel = settings == null ? 0 : settings.getDouble("radius-per-level", 0);
                radius += perLevel * enchants.getLevel(player.getUniqueId(), ID).doubleValue();

                // RULE 8 + RULE 4: MineService pays exactly like mining and already honours the
                // player's Virtual Block Breaking toggle — nothing extra to do here.
                int broken = mines.breakSphere(player, center, radius, blockCurr, autosell, tokenGreed);
                if (broken <= 0) return;

                // RULE 2 + 6: async packets, whole mine, per-viewer toggles (all inside Fx).
                Fx.particle(player, world, Particle.EXPLOSION_LARGE, center, 3, 1, 0);
                Fx.sound(player, world, Sound.ENTITY_GENERIC_EXPLODE, center, 1f, 0.8f);

                // RULE 4: the configurable proc message; handles both message mute toggles for you.
                enchants.sendProcMessage(player, ID, "{blocks}", String.valueOf(broken));
            }
        }
        \`\`\`

        ----------------------------------------------------------------------------
        EXAMPLE 2 — Jackhammer (break whole layers)
        ----------------------------------------------------------------------------
        \`\`\`java
        public class JackhammerEnchant implements APIEnchant {

            private static final String ID = "jackhammer";

            @Override public boolean asyncSafe() { return true; }

            @Override
            public void onProc(Player player, EnchantData data) {
                if (!(data instanceof BlockBreakEnchantData hit)) return;
                PinnaPrisonAPI api = PinnaPrisonAPI.getInstance();
                var settings = api.getEnchants().getSettings(ID);
                int extraLayers = settings == null ? 0 : settings.getInt("extra-layers", 0);

                int y = hit.getPosition().getBlockY();
                int broken = 0;
                for (int layer = y; layer <= y + extraLayers; layer++) {
                    broken += api.getMines().breakLayer(player, layer, false, true, true);
                }
                if (broken > 0) api.getEnchants().sendProcMessage(player, ID, "{blocks}", String.valueOf(broken));
            }
        }
        \`\`\`

        ----------------------------------------------------------------------------
        EXAMPLE 3 — Currency reward enchant (settings: + proc-message + chain variables)
        ----------------------------------------------------------------------------
        Reads the currency id and a {level}-substituted amount from settings:, pays it BOOSTED, and
        sends the configurable proc-message. Nothing is hardcoded — the admin tunes the currency,
        the amount and the message in the yaml.
        \`\`\`java
        package com.example.enchants;

        import es.edwardbelt.pinnaprison.iapi.PinnaPrisonAPI;
        import es.edwardbelt.pinnaprison.iapi.enchant.APIEnchant;
        import es.edwardbelt.pinnaprison.iapi.enchant.data.EnchantData;
        import es.edwardbelt.pinnaprison.iapi.service.CurrencyService;
        import es.edwardbelt.pinnaprison.iapi.service.EnchantService;
        import es.edwardbelt.pinnaprison.iapi.service.FormatService;
        import org.bukkit.configuration.ConfigurationSection;
        import org.bukkit.entity.Player;
        import java.math.BigDecimal;
        import java.util.UUID;

        public class GreedEnchant implements APIEnchant {

            private final String id;
            public GreedEnchant(String id) { this.id = id; } // registerEnchant("tokengreed", new GreedEnchant("tokengreed"))

            @Override public boolean asyncSafe() { return true; } // pure data

            @Override
            public void onProc(Player player, EnchantData data) {
                PinnaPrisonAPI api = PinnaPrisonAPI.getInstance();
                EnchantService enchants = api.getEnchants();
                CurrencyService currencies = api.getCurrencies();
                FormatService format = api.getFormat();
                UUID uuid = player.getUniqueId();

                ConfigurationSection settings = enchants.getSettings(id);
                if (settings == null) return;
                String currency   = settings.getString("currency", "tokens");
                String amountExpr = settings.getString("amount", "1000 + {level}");

                BigDecimal level = enchants.getLevel(uuid, id);
                BigDecimal amount = evaluate(amountExpr.replace("{level}", level.toPlainString()));

                // A chained proc can scale off whatever the source enchant exposed (e.g. its blocks).
                String chainBlocks = data.getChainVariables().get("blocks");
                if (chainBlocks != null) {
                    try { amount = amount.multiply(new BigDecimal(chainBlocks)); } catch (NumberFormatException ignored) {}
                }

                // ALWAYS the boosted add for a reward: boosters, crystals, rebirth, gang all apply.
                currencies.addBalanceBoosted(uuid, currency, amount);

                // format() makes the number read exactly like PinnaPrison's own lore/placeholders.
                enchants.sendProcMessage(player, id,
                        "{amount}", format.format(amount),
                        "{currency}", currencies.getDisplayName(currency));
            }

            private BigDecimal evaluate(String expr) {
                try { return new BigDecimal(expr.trim()); } catch (Exception e) { return BigDecimal.ZERO; }
            }
        }
        \`\`\`
        Its yaml would carry:
        \`\`\`yaml
        proc-message: '&6Greed! &e+{amount} {currency}'
        settings:
          currency: tokens
          amount: '1000 + ({level} * 50)'
        \`\`\`

        ----------------------------------------------------------------------------
        EXAMPLE 4 — Comet (animated EdLib entity + impact) — the showpiece
        ----------------------------------------------------------------------------
        A burning falling block streaks down and slams into the mine, blasting a sphere. It shows the
        difference between doing this right and wrong:
          - the entity is created and spawned ASYNC (rule 1) and shown with spawnInMine (rule 3),
          - movement is a GOAL, not a manual timer,
          - the trail particles go to every mine viewer, gated per viewer (rules 2 + 6),
          - a floating text display announces the hit (displays are never hidden by the mob toggle),
          - a fail-safe despawn runs even if the player logs out mid-flight (rule 9),
          - every number comes from settings: (rule 7).
        \`\`\`java
        package com.example.enchants;

        import com.example.util.Fx;
        import es.edwardbelt.edlib.iapi.EdLibAPI;
        import es.edwardbelt.edlib.iapi.EdColor;
        import es.edwardbelt.edlib.iapi.entity.BillboardMode;
        import es.edwardbelt.edlib.iapi.entity.EdEntity;
        import es.edwardbelt.edlib.iapi.entity.EdFallingBlock;
        import es.edwardbelt.edlib.iapi.entity.goal.impl.EdGoalMove;
        import es.edwardbelt.pinnaprison.iapi.PinnaPrisonAPI;
        import es.edwardbelt.pinnaprison.iapi.enchant.APIEnchant;
        import es.edwardbelt.pinnaprison.iapi.enchant.data.BlockBreakEnchantData;
        import es.edwardbelt.pinnaprison.iapi.enchant.data.EnchantData;
        import es.edwardbelt.pinnaprison.iapi.service.EnchantService;
        import es.edwardbelt.pinnaprison.iapi.service.MineService;
        import org.bukkit.Location;
        import org.bukkit.Material;
        import org.bukkit.Particle;
        import org.bukkit.Sound;
        import org.bukkit.World;
        import org.bukkit.configuration.ConfigurationSection;
        import org.bukkit.entity.EntityType;
        import org.bukkit.entity.Player;
        import org.bukkit.util.Vector;

        import java.util.List;

        public class CometEnchant implements APIEnchant {

            private static final String ID = "comet";

            @Override public boolean asyncSafe() { return true; } // entities, goals and breaks are all packets

            @Override
            public void onProc(Player player, EnchantData data) {
                if (!(data instanceof BlockBreakEnchantData hit)) return;

                PinnaPrisonAPI api = PinnaPrisonAPI.getInstance();
                EdLibAPI edlib = EdLibAPI.getInstance();
                MineService mines = api.getMines();
                EnchantService enchants = api.getEnchants();
                World world = mines.getMinesWorld();
                if (world == null) return;

                // RULE 7 — every knob is admin-tunable, read fresh each proc.
                ConfigurationSection s = enchants.getSettings(ID);
                double radius     = s == null ? 3.0  : s.getDouble("crater-radius", 3.0);
                double speed      = s == null ? 1.4  : s.getDouble("fall-speed", 1.4);
                double height     = s == null ? 16   : s.getDouble("spawn-height", 16);
                String blockName  = s == null ? "MAGMA_BLOCK" : s.getString("block", "MAGMA_BLOCK");
                boolean blockCurr = s != null && s.getBoolean("affect-block-currencies", false);
                boolean autosell  = s == null || s.getBoolean("affect-autosell", true);
                boolean greed     = s == null || s.getBoolean("affect-tokengreed", true);
                long failSafe     = s == null ? 200L : s.getLong("failsafe-ticks", 200L);

                Material blockMaterial = Material.matchMaterial(blockName);
                if (blockMaterial == null) blockMaterial = Material.MAGMA_BLOCK;

                Vector impact = Fx.center(hit.getPosition());
                Vector spawn  = impact.clone().add(new Vector(0, height, 0));

                // RULE 1 — created and spawned straight off the async proc thread. No sync hop.
                EdFallingBlock comet = (EdFallingBlock) edlib.createEntity(EntityType.FALLING_BLOCK,
                        new Location(world, spawn.getX(), spawn.getY(), spawn.getZ()));
                if (comet == null) return;
                comet.setFallingBlock(blockMaterial);
                comet.setGravity(false);                 // the goal drives it
                comet.setGlowing(EdColor.GOLD);          // one of the 16 CHAT colours only — see the GLOWING WARNING
                comet.setInFire(true);

                // RULE 3 — the whole mine sees it; viewers who muted enchant mobs are skipped for us.
                mines.spawnInMine(player, comet);

                EdGoalMove fall = new EdGoalMove(impact, speed);

                // RULE 2 + 6 — the trail, sent to every viewer that wants particles, from the goal thread.
                fall.setEachTickRunnable(() -> {
                    Vector p = comet.getPosition();
                    Fx.particle(player, world, Particle.FLAME, p, 4, 0.2, 0.0);
                    Fx.particle(player, world, Particle.SMOKE_LARGE, p, 2, 0.15, 0.01);
                });

                fall.setEndRunnable(() -> {
                    mines.despawnInMine(player, comet);          // RULE 3 — never entity.remove()

                    int broken = mines.breakSphere(player, impact, radius, blockCurr, autosell, greed);

                    Fx.particle(player, world, Particle.EXPLOSION_LARGE, impact, 4, 1.0, 0.0);
                    Fx.sound(player, world, Sound.ENTITY_GENERIC_EXPLODE, impact, 1f, 0.8f);

                    if (broken > 0) {
                        floatingText(player, world, impact.clone().add(new Vector(0, 2, 0)),
                                "§6§l☄ §e" + broken + " blocks", 40L);
                        enchants.sendProcMessage(player, ID, "{blocks}", String.valueOf(broken));
                    }
                });

                comet.addGoal(fall);

                // RULE 9 — fail-safe: if the player logs out or leaves the mine mid-flight the goal's
                // endRunnable may never run, so untrack + despawn unconditionally a bit later.
                EdLibAPI.getExecutor().asyncLater(
                        () -> mines.despawnInMine(player, comet), failSafe, "comet-cleanup");
            }

            /**
             * A short-lived floating text display. Displays are NEVER hidden by the mob-entities toggle.
             *
             * NOTE the factory: createTextDisplay, NOT createEntity(EntityType.TEXT_DISPLAY, ...).
             * createEntity cannot build ANY of the three display types and throws
             * "TEXT_DISPLAY is not a supported entity" if you try.
             */
            private void floatingText(Player player, World world, Vector pos, String text, long ticks) {
                MineService mines = PinnaPrisonAPI.getInstance().getMines();
                EdEntity display = EdLibAPI.getInstance().createTextDisplay(
                        new Location(world, pos.getX(), pos.getY(), pos.getZ()), List.of(text));
                if (display == null) return;
                display.setBillboard(BillboardMode.CENTER);   // always faces the viewer — call BEFORE spawn
                display.setBackground(0);                     // fully transparent background
                display.setTextShadow(true);
                display.setSeeThrough(false);
                display.setTeleportDuration(3);               // any tp glides instead of snapping
                // The text came from the factory — setText(...) is for CHANGING it on a live display.
                // enchantMob=false: a text display is not a "mob", and this keeps the intent explicit.
                mines.spawnInMine(player, display, false);
                EdLibAPI.getExecutor().asyncLater(
                        () -> mines.despawnInMine(player, display), ticks, "comet-text");
            }
        }
        \`\`\`

        ----------------------------------------------------------------------------
        EXAMPLE 5 — Ice Age (fake blocks) — the ONE case where you must handle
        Virtual Block Breaking yourself
        ----------------------------------------------------------------------------
        Freezes a region to ICE for a moment, then shatters it. Because the animation lied to the
        client about the blocks, it MUST reveal them again: after a normal break the chunk resend
        clears the lie for free, but with Virtual Block Breaking on nothing is broken and no resend
        happens, so the ice would stay forever. \`revealBlocks\` is safe to call either way, so just
        always call it.
        \`\`\`java
        package com.example.enchants;

        import com.example.util.Fx;
        import es.edwardbelt.edlib.iapi.EdLibAPI;
        import es.edwardbelt.pinnaprison.iapi.PinnaPrisonAPI;
        import es.edwardbelt.pinnaprison.iapi.enchant.APIEnchant;
        import es.edwardbelt.pinnaprison.iapi.enchant.EnchantRegions;
        import es.edwardbelt.pinnaprison.iapi.enchant.data.BlockBreakEnchantData;
        import es.edwardbelt.pinnaprison.iapi.enchant.data.EnchantData;
        import es.edwardbelt.pinnaprison.iapi.service.EnchantService;
        import es.edwardbelt.pinnaprison.iapi.service.MineService;
        import org.bukkit.Material;
        import org.bukkit.Particle;
        import org.bukkit.Sound;
        import org.bukkit.World;
        import org.bukkit.configuration.ConfigurationSection;
        import org.bukkit.entity.Player;
        import org.bukkit.util.Vector;

        import java.util.List;
        import java.util.Set;

        public class IceAgeEnchant implements APIEnchant {

            private static final String ID = "iceage";

            @Override public boolean asyncSafe() { return true; }

            @Override
            public void onProc(Player player, EnchantData data) {
                if (!(data instanceof BlockBreakEnchantData hit)) return;

                PinnaPrisonAPI api = PinnaPrisonAPI.getInstance();
                MineService mines = api.getMines();
                EnchantService enchants = api.getEnchants();
                World world = mines.getMinesWorld();

                ConfigurationSection s = enchants.getSettings(ID);
                double radius   = s == null ? 4     : s.getDouble("radius", 4);
                long freezeTicks = s == null ? 30L  : s.getLong("freeze-ticks", 30L);
                String iceName  = s == null ? "BLUE_ICE" : s.getString("freeze-block", "BLUE_ICE");
                Material ice = Material.matchMaterial(iceName);
                if (ice == null) ice = Material.BLUE_ICE;

                Vector center = Fx.center(hit.getPosition());
                Set<Vector> region = EnchantRegions.sphere(hit.getPosition(), radius);

                // Lie to the clients. Returns EXACTLY what was disguised.
                List<Vector> frozen = mines.disguiseBlocks(player, region, ice);
                if (frozen.isEmpty()) return;

                Fx.particle(player, world, Particle.SNOWFLAKE, center, 40, radius / 2, 0.02);
                Fx.sound(player, world, Sound.BLOCK_GLASS_BREAK, center, 1f, 0.6f);

                EdLibAPI.getExecutor().asyncLater(() -> {
                    int broken = mines.breakBlocks(player, frozen, false, true, true);

                    // ALWAYS lift the disguise. Under Virtual Block Breaking nothing was broken and no
                    // chunk resend happened, so without this the ice would linger on the client.
                    mines.revealBlocks(player, frozen);

                    Fx.particle(player, world, Particle.BLOCK_CRACK, center, 60, radius / 2, 0.1);
                    Fx.sound(player, world, Sound.BLOCK_AMETHYST_BLOCK_BREAK, center, 1f, 1.4f);
                    if (broken > 0) enchants.sendProcMessage(player, ID, "{blocks}", String.valueOf(broken));
                }, freezeTicks, "iceage-shatter");
            }
        }
        \`\`\`

        ============================================================================
        EdLib API (es.edwardbelt.edlib.iapi) — packet entities, models, goals
        ============================================================================
        EdLibAPI interface: es.edwardbelt.edlib.iapi
        Static: void setInstance(EdLibAPI), EdLibAPI getInstance()
                TaskExecutor getExecutor(), void setExecutor(TaskExecutor)  // scheduler (see SCHEDULING)
        Instance:
        EdModel getModel(String modelId)
        EdEntity createEntity(EntityType type, Location location)   // MOBS + projectiles + FALLING_BLOCK / TNT / ARMOR_STAND / INTERACTION / MARKER; cast to EdFallingBlock / EdPrimedTNT / EdEntityVariantable where relevant.
          // ^ NOT for displays. createEntity only knows entity types that have a spawnable constructor,
          //   and THROWS "TEXT_DISPLAY is not a supported entity. Supported entities: [...]" for the
          //   three display types. Each display has its OWN factory below — always use those:
          //     TEXT_DISPLAY  -> createTextDisplay(location, lines)
          //     BLOCK_DISPLAY -> createBlockDisplay(location, matrix, material)
          //     ITEM_DISPLAY  -> createItemDisplay(location, matrix, texture, uuidArray, name)
        EdEntity createTextDisplay(Location location, List<String> lines)  // a floating text / hologram, one entry per line
          // ^ THE only way to make a text display. Goes through EdLib's internal NMS text-display
          //   builder, so it works on every supported server version. Legacy colour codes are parsed,
          //   hex included (a raw literal component would degrade a hex colour to its last valid code).
          //   Style it with the EdEntity display setters BEFORE spawn(), and change the text later
          //   with setText(List<String>) — a metadata packet, no despawn/respawn, no flicker.
        EdNPC createNPC(Location location, String name, String skinTexture, String skinSignature) // packet player NPC (profile name capped at 16 chars)
        EdEntity createInteractionEntity(Location location, float height, float width) // note: height BEFORE width
        EdEntity createBlockDisplay(Location location, Matrix4f transformation, Material material)
        EdEntity createItemDisplay(Location location, Matrix4f transformation, String skinTexture, int[] profileUuid, String profileName)
          // ^ this overload builds an item display holding a CUSTOM PLAYER HEAD: skinTexture is the
          //   base64 "textures" value, profileUuid an int[4] uuid, profileName the profile name.
        EdEntity createItemDisplay(Location location, Matrix4f transformation, ItemStack item)
          // ^ for a NORMAL item. Never createEntity(EntityType.ITEM_DISPLAY, loc) — that throws
          //   "ITEM_DISPLAY is not a supported entity" exactly like TEXT_DISPLAY does.
        EdWorld createWorld()
        // --- optional-plugin integrations (all safe to call blindly; they report "not installed") ---
        boolean isModelEngineEnabled()
        EdModelEngineEntity createModelEngineEntity(String modelId, Location location) // null when ModelEngine isn't installed or the model id is unknown
        float[] getModelEngineHitbox(String modelId)     // [width, height] in blocks, or null
        boolean isMythicMobsEnabled()
        EdMythicMobInfo getMythicMobInfo(String mobName) // resolve a MythicMobs definition WITHOUT spawning it; null if not installed / unknown
        void sendActionbar(Player player, String message)   // inside PinnaPrison prefer DisplayService
        void sendXPBar(Player player, float progress, int level)
        void hidePlayer(Player viewer, Player target)
        void showPlayer(Player viewer, Player target)
        void sendBlocks(Player player, Map<Vector, Material> blocks) // raw fake blocks; inside a mine prefer MineService#disguiseBlocks
        void sendBossBar(Player player, UUID bossBarId, String title, float progress, String color)
        void updateBossBarTitle(Player player, UUID bossBarId, String title)
        void updateBossBarProgress(Player player, UUID bossBarId, float progress)
        void removeBossBar(Player player, UUID bossBarId)

        EdEntity interface: es.edwardbelt.edlib.iapi.entity
        Integer getId(); UUID getUUID(); EntityType getType(); Object getEntity()
        void addWatcher(Player player); void removeWatcher(Player player); Collection<Player> getWatchers()
          // ^ inside a mine use MineService#spawnInMine instead — it adds the watchers, spawns, tracks
          //   the entity and applies the mob-entities toggle for you.
        void damageEffect(); void spawn(); void spawnForPlayer(Player player); void remove(); void removeForPlayer(Player player)
        void setGravity(boolean hasGravity); void setInFire(boolean inFire)
        void setEquipment(EntityEquipmentSlot slot, ItemStack item)  // inside a mine use MineService#setEntityEquipment so late viewers see it
        void playAnimation(EntityAnimation animation)
        void setRightArmPose(float xDeg, float yDeg, float zDeg)  // ARMOR STANDS: the client never renders the swing animation on an armor stand, so fake a swing by snapping the arm pose and back (the held item follows the arm bone even with arms hidden). Vanilla defaults: right -10,0,-10 / left -15,0,10. Set before spawn() to ride the spawn metadata; after spawn it broadcasts a metadata update.
        void setLeftArmPose(float xDeg, float yDeg, float zDeg)
        void setSlimeSize(int size); void setSmall(); void setInvisible()
        void setSheepColor(EdColor color)           // sheep wool colour
        void setScale(float scale)                  // minecraft:scale attribute, 1 = normal (1.21.x / 26.1+; no-op on 1.20.4)
        void setDinnerbone(boolean d); boolean isDinnerbone() // render upside down (living entities; while on, any display name is shown via a text-display passenger instead of the name tag)
        void setDisplayName(String name); void setGlowing(EdColor color) /* 16 vanilla chat colours only — see GLOWING WARNING */; float getNameHeight()
        void setText(List<String> lines)            // TEXT DISPLAYS: update the lines in place via a metadata packet — no despawn/respawn, no flicker
        void setBillboard(BillboardMode mode)       // displays: rotation constraint — call before spawn(); text displays default to CENTER (faces the player)
        // Display-entity styling — set BEFORE spawn() when possible (it rides in the spawn metadata);
        // calling after spawn also broadcasts a metadata update. All no-ops on non-display entities:
        void setBackground(int argb)                // text displays: ARGB background (0xAARRGGBB); 0 = fully transparent (vanilla default 0x40000000 semi-transparent black)
        void setShadowRadius(float radius)          // ground shadow in blocks; 0 = none (default)
        void setShadowStrength(float strength)      // 1 = default, higher = darker; needs shadowRadius > 0
        void setDisplayWidth(float w); void setDisplayHeight(float h) // culling box; 0 (default) = never culled
        void setLineWidth(int width)                // text displays: wrap width in pixels (default 200)
        void setTextShadow(boolean shadowed)        // text displays: character drop shadow (off by default)
        void setSeeThrough(boolean seeThrough)      // text displays: visible through blocks (off by default)
        void setTeleportDuration(int ticks)         // displays: teleport interpolation 0-59 ticks — while set, tp/shortTp/goal moves GLIDE smoothly instead of snapping
        Vector getPosition()
        void tp(double x, double y, double z); void shortTp(double x, double y, double z) // shortTp = move packet-entities inside goals
        void rotateBodyAndMove(double x, double y, double z, float yaw, float pitch)
        void setNMSLocation(double x, double y, double z, float yaw, float pitch)
        void setTransformation(Matrix4f transformation)
        void setTransformationWithInterpolation(Matrix4f transformation, int duration)
        void setTransformationWithInterpolation(Matrix4f transformation, int duration, int delay)
        void setInterpolationDuration(int duration); void startInterpolation()
        void setYawHead(float yaw); void setYaw(float yaw); void setPitch(float pitch)
        void rotateBody(float yaw, float pitch); void rotateHead(float yaw); Vector getLocVector()
        void setPassengers(List<EdEntity> passengers); void addPassenger(EdEntity passenger)
        void addPassenger(Player player)            // mount a REAL player client-side: the mount packet is broadcast to this entity's watchers, so clients render (and the rider physically attaches to) the packet entity. Nothing changes server-side — safe for cosmetic/AFK rides. Add the player as a watcher and spawn() FIRST, or the client drops the packet.
        void removePassenger(Player player)         // dismount a real player (removing the entity also dismounts)
        void resendPassengers(Player player)        // re-send the mount packet to ONE player: after showing an already-spawned vehicle + passengers to a new watcher (passengers last), call this or the passengers won't ride for them
        void addGoal(EdGoal goal); void startNextGoal(); void onGoalComplete()
        Queue<EdGoal> getGoalQueue(); EdGoal getCurrentGoal(); void setCurrentGoal(EdGoal goal)
        void clearGoals(); void skipCurrentGoal()
        EdLivingEntity interface: es.edwardbelt.edlib.iapi.entity
        EdFallingBlock interface: Material getBlockMaterial(); void setFallingBlock(Material material)
        EdPrimedTNT interface: long getFuseTicks(); void setFuseTicks(long ticks); Material getMaterial(); void setMaterial(Material material)
        EdNPC interface (extends EdEntity) — a packet player NPC:
          String getProfileName(); void setSkin(String texture, String signature) (respawns for watchers);
          void setSkinParts(byte parts) (0x7F = all); void setSecondLayerVisible(boolean);
          boolean isTabListed(); void setTabListed(boolean); void setTabName(String) (null resets);
          boolean isNameTagVisible(); void setNameTagVisible(boolean); boolean isSneaking(); void setSneaking(boolean);
          void lookAt(double x, double y, double z); void lookAt(Vector target)
          // NOTE: the name above the head is the game PROFILE name (16 chars max, legacy colour codes
          // allowed) and is fixed at creation; setDisplayName() updates the TAB LIST name instead,
          // because custom-name metadata isn't rendered for player entities.
        EntityHolder class: es.edwardbelt.edlib.iapi.entity — ctors (Entity) or (EdEntity); Vector getPosition()
        EdEntityVariantable interface (extends EdEntity): void setVariant(EntityVariant.Variant variant)
          // mob variants for packet entities (cast the EdEntity from createEntity for supported types).
          // EntityVariant (es.edwardbelt.edlib.iapi.entity) holds nested enums, each implements Variant:
          //   Axolotl (LUCY, WILD, GOLD, CYAN, BLUE), Cat (TABBY, BLACK, RED, SIAMESE, BRITISH_SHORTHAIR,
          //   CALICO, PERSIAN, RAGDOLL, WHITE, JELLIE, TUXEDO), Chicken/Cow/Frog/Pig (TEMPERATE, COLD, WARM),
          //   Mooshroom (RED, BROWN), Parrot (RED, BLUE, GREEN, CYAN, GRAY), Rabbit (BROWN, ALBINO, BLACK,
          //   BLACK_AND_WHITE, GOLD, SALT_AND_PEPPER, KILLER_BUNNY), Salmon (SMALL, MEDIUM, LARGE),
          //   Fox (RED, SNOW), Llama (CREAMY, WHITE, BROWN, GRAY), Panda (DEFAULT, AGGRESSIVE, LAZY, WORRIED,
          //   PLAYFUL, WEAK, BROWN), Wolf (PALE, ASHEN, BLACK, CHESTNUT, RUSTY, SNOWY, SPOTTED, STRIPED, WOODS)
          // static <T> EntityVariant.getVariant(EntityType type, String value) resolves a config string
          // ("snow", "killer_bunny" uses the in-game value e.g. "evil") to the enum constant, null if unknown.

        ModelEngine (Blockbench models as packet entities) — es.edwardbelt.edlib.iapi.entity
        EdModelEngineEntity extends EdEntity — the model rides a ModelEngine Dummy (packet-only, no real
        server entity), so watchers, goals, teleports and rotation all work exactly like any EdEntity and
        nothing is persisted. Vanilla-only EdEntity members with no model equivalent (equipment, sheep
        colour, slime size, display transformations, passengers) are safe no-ops.
          String getModelId();
          boolean isModelLoaded()     // true once the model finished initialising on the main thread after spawn() and hasn't been removed. ModelEngine silently drops animations queued before that — the entity buffers the idle animation for you, but wait for this before a one-shot.
          void playAnimation(String animation)                     // one-shot, default lerp (0.2s), normal speed
          void playAnimation(String animation, double lerpIn, double lerpOut, double speed, boolean loop)
          void stopAnimation(String animation)                     // also how a looped animation ends
          void setModelScale(double scale)                         // 1 = authored size; before or after spawn(). setScale(float) delegates here
          // HITBOX/CLICKS: when the blueprint defines a main 'hitbox' bone, an invisible interaction
          // hitbox of that size spawns and follows the model, and getId() returns the HITBOX entity id —
          // the id CLICK_ENTITY packets carry — so PlaceableService#registerClickable works unchanged.
          // Models without a hitbox bone are not clickable.
        EdMythicMobInfo class (from EdLibAPI#getMythicMobInfo) — a read-only snapshot of a MythicMobs
        definition, resolved WITHOUT spawning anything: String getEntityType(); String getDisplayName()
        (null when it needs a live mob); double getHealth() (0 when it's an expression); String getModelId()
        (the ModelEngine model from its model{} skill, or null). Typical use: if getModelId() is set render
        it as an EdModelEngineEntity, otherwise spawn a packet entity of getEntityType() and apply the name.

        EdModel interface (EdLib's own model format): es.edwardbelt.edlib.iapi.model
        String getId(); Float getMaxHeight(); EdModelEntity createEntity(Location location)
        EdModelEntity interface: EdEntity getInteractionEntity()/getMainEntity()/getDisplayName();
        Map<String,EdEntity> getPassengers(); EdModel getModel(); void setYaw(float)/setPitch(float)/rotate(float,float);
        void spawn(); void setGlowing(EdColor) /* 16 vanilla chat colours only */; void addWatcher(Player); void remove();
        void playAnimation(String)/playLoopAnimation(String)/stopAnimation(); boolean isPlayingAnimation(); String getCurrentAnimation()
        void setScale(float scale)                  // scales the whole model (parts + animation keyframes) around its anchor; before/after spawn, safe mid-animation
        float getScale()
        void setTeleportDuration(int ticks)         // teleport interpolation on every display part — model moves glide (see EdEntity#setTeleportDuration)
        void setSmoothMovement(int interpolationTicks) // detaches parts from the anchor and drives them with interpolated teleports; enable BEFORE spawn(), then move with tp(...) — or syncParts() each tick when a goal drives the main entity
        void setModelOffset(double x, double y, double z) // offsets the rendered model (anchor, parts, hitbox) relative to the logical tp position WITHOUT moving the floating name — re-centres models whose geometry origin sits off-centre. Blocks at scale 1; scales with setScale. Applies on the next teleport
        void tp(double x, double y, double z)       // teleport whole model (anchor, parts, name, hitbox), keeps rotation
        void tp(double x, double y, double z, float yaw, float pitch) // + rotate in the same packet; in smooth mode position AND rotation interpolate together (fluid banking turns)
        void syncParts()                            // snap every part to the main entity's position — call each tick when a goal moves the main entity in smooth mode

        Goal System (es.edwardbelt.edlib.iapi.entity.goal) — drive packet-entity movement
        EdGoal abstract class — void start()/init()/forceStop(); boolean isRunning()/shouldExecute(); void tick();
          void setEndRunnable(Runnable); void setStartRunnable(Runnable); void setEachTickRunnable(Runnable);
          EdEntity getEntity(); void setEntity(EdEntity); boolean isForceStopped()
          // The goal ticks on an EdLib ASYNC repeating task (1 tick period). endRunnable fires when
          // shouldExecute() turns false — but NOT when the goal was forceStop()ed, which is exactly why
          // every animation also needs the asyncLater fail-safe despawn (rule 9).
        Goal impls (es.edwardbelt.edlib.iapi.entity.goal.impl):
        EdGoalMove(Vector moveGoal, double speed) — straight-line move (speed = blocks per tick); setAffectY/setSendRotationEachTick/setInvertRotation/setSendRotation
        EdGoalArchMove(Vector end, double speed, long duration)
        EdGoalParabolicMove(Vector end, double height, long duration) — teleports each tick
        EdGoalDisplayParabolicMove(Vector end, double height, long duration, int keyframeTicks, Matrix4f baseTransform)
          // parabolic flight for DISPLAY entities with client-side interpolation: instead of teleporting
          // each tick (EdGoalParabolicMove, can look choppy) the transformation translation is keyframed
          // every keyframeTicks and the client glides between keyframes — perfectly smooth. baseTransform
          // = the display's standing transformation (scale/centering; null = identity); each keyframe
          // sends translate(arcOffset) * baseTransform. The underlying entity never moves — use
          // getVisualPosition() for where viewers see it (particle trails). 2-4 keyframeTicks is smooth.
        EdGoalOrbit(Vector center, double radius, double angularSpeed, boolean clockwise, int ticksDuration) — getCenterPoint/getRadius/isClockwise/getCurrentAngle/setAffectY/...
        EdGoalFollowEntity(EntityHolder target, double followDistance, double speed, long duration) // huge duration = "infinite"
        EdGoalDelay(int delayTicks) — getProgress/getRemainingTicks/getRemainingSeconds (pause a goal chain)
        Queue several goals on one entity with addGoal(...) — they run in order, each one's endRunnable
        firing before the next starts. You can also write your own: extend EdGoal, override
        shouldExecute()/tick(), and move with EdEntity#shortTp.

        SCHEDULING (es.edwardbelt.edlib.iapi.task) — EdLib's own scheduler, the right one for packet work:
        TaskExecutor executor = EdLibAPI.getExecutor();
        EdTask async(Runnable task, String name)                         // run off the main thread now
        EdTask asyncLater(Runnable task, long delayTicks, String name)   // run off-thread after a delay
        EdTask repeatedAsync(Runnable task, double delayTicks, double periodTicks, String name) // async repeating
        EdTask sync(Runnable task, String name)                          // hop to the MAIN thread (only for Bukkit world/entities/inventories)
        EdTask syncLater(Runnable task, long delayTicks, String name)
        EdTask: void cancel(); boolean isCancelled(); int getTaskId()
        Use async/asyncLater for every packet effect and timer; use sync ONLY when you must touch the
        real Bukkit world/entities/inventory. For timed entity sequences prefer goal runnables
        (setEachTickRunnable / setEndRunnable) or EdGoalDelay over manual timers.

        PACKET WORLDS (es.edwardbelt.edlib.iapi.world) — in-memory "fake" worlds streamed to players:
        EdWorld (from EdLibAPI#createWorld()):
          EdChunk getOrCreateChunk(int chunkX, int chunkZ)   // creates an empty chunk if missing
          void addWatcher(Player); void removeWatcher(Player); Collection<Player> getWatchers()
          EdWorld copy()                                     // deep copy (chunks cloned, watchers not)
        EdChunk: (x/z are chunk-local 0-15, y is absolute world height)
          void setBlock(int x, int y, int z, Material material); Material getBlock(int x, int y, int z)
          void send(Player player)                           // stream to the player as a level-chunk packet
          Object getPacket()                                 // the built NMS chunk packet (version-specific type)
          EdChunkCoordIntPair getChunkCoord(); EdChunkSection getChunkSection(int index); EdChunk copy()
        EdChunkSection: void setBlockId(int x, int y, int z, int blockId) // raw NMS palette ids — only meaningful within the same EdLib version
        EdChunkCoordIntPair: plain value type (safe map key) — int getX(), int getZ()
        ChunkBlockConsumer (functional): void accept(int sectionIndex, Vector position, int blockId) // callback receiving each non-air block of a live chunk

        Enums:
        EdColor (es.edwardbelt.edlib.iapi): BLACK, DARK_BLUE, DARK_GREEN, DARK_AQUA, DARK_RED, DARK_PURPLE,
          GOLD, GRAY, DARK_GRAY, BLUE, GREEN, AQUA, RED, LIGHT_PURPLE, YELLOW, WHITE, ORANGE, MAGENTA,
          LIGHT_BLUE, LIME, PINK, LIGHT_GRAY, CYAN, PURPLE, BROWN  (String getName())
          !!! GLOWING WARNING: setGlowing(EdColor) colours the entity via a scoreboard TEAM, whose
          colour MUST be one of the 16 vanilla chat colours. ONLY these 16 are valid for setGlowing:
          BLACK, DARK_BLUE, DARK_GREEN, DARK_AQUA, DARK_RED, DARK_PURPLE, GOLD, GRAY, DARK_GRAY, BLUE,
          GREEN, AQUA, RED, LIGHT_PURPLE, YELLOW, WHITE.
          The other 9 (ORANGE, MAGENTA, LIGHT_BLUE, LIME, PINK, LIGHT_GRAY, CYAN, PURPLE, BROWN) are
          dye/extended colours that are NOT valid team colours — passing one to setGlowing throws a
          ClientboundSetPlayerTeamPacket NullPointerException during packet encode and DISCONNECTS the
          player ("Cannot invoke Enum.ordinal() because instance is null"). Never use them for glow.
          (setSheepColor accepts all 25 — the restriction is glowing only.)
        BillboardMode (es.edwardbelt.edlib.iapi.entity): FIXED, VERTICAL, HORIZONTAL, CENTER — for
          entity.setBillboard(...) on display entities. CENTER = always faces the player (hologram look);
          FIXED = static; VERTICAL/HORIZONTAL rotate around one axis only.
        EntityAnimation (es.edwardbelt.edlib.iapi.entity): SWING_MAIN_HAND(0), SWING_OFF_HAND(3), LEAVE_BED(1), CRITICAL_EFFECT(4), MAGIC_CRITICAL_EFFECT(5)
        EntityEquipmentSlot (es.edwardbelt.edlib.iapi.entity): MAIN_HAND(0), OFF_HAND(1), BOOTS(2), LEGGINGS(3), CHESTPLATE(4), HELMET(5), BODY(6), SADDLE(7)

        ============================================================================
        BEST PRACTICES (checklist before you ship an enchant)
        ============================================================================
        - asyncSafe() returns TRUE and onProc stays packet/data only (MineService breaks, EdLib
          entities, currency changes, per-player particles/sounds). Return false only if you truly
          must touch the real Bukkit world/entities/inventories.
        - Break + reward ONLY through MineService (breakBlocks/breakLayer/breakSphere/breakBlock).
          Never touch the real world — mines have no real blocks. Default affectBlockCurrencies to
          false and affectAutosell + affectTokenGreed to true unless told otherwise, and expose all
          three as settings: flags.
        - Show packet entities with mines.spawnInMine(player, entity) and remove them with
          mines.despawnInMine(player, entity). Never addWatcher+spawn, never entity.remove().
          Use the (player, entity, false) overload only for something that is genuinely part of the
          mine rather than an enchant animation.
        - Dress mine entities with mines.setEntityEquipment(...), not entity.setEquipment(...), so
          viewers who arrive mid-animation see the gear.
        - Particles/sounds are PER PLAYER packets: send them to mines.getMineViewers(player) and gate
          each viewer on isParticlesDisabled / isSoundsDisabled. Route them through an Fx helper so a
          toggle can never be forgotten. The more (gated) particle FX, the better.
        - Chat only through enchants.sendProcMessage(player, id, "{token}", value, ...) — it already
          respects both mute toggles, colours and PlaceholderAPI. Never build proc chat by hand.
        - If you disguised blocks, ALWAYS mines.revealBlocks(...) when the animation ends — under
          Virtual Block Breaking nothing else will clear them.
        - Move packet entities through goals (EdGoalMove/Orbit/Parabolic/Arch/Follow/Delay) or a
          custom EdGoal using EdEntity#shortTp. Time sequences with setEachTickRunnable/setEndRunnable
          rather than manual timers.
        - Every spawned entity gets BOTH an endRunnable despawn and an asyncLater fail-safe despawn,
          in case the player leaves the mine or logs out mid-animation.
        - Centre block positions with +0.5 when spawning entities or playing FX (block coords ->
          block centre).
        - Scale the effect with the enchant level via enchants.getLevel(uuid, id) — and put the
          per-level factor in settings:, not in code.
        - NEVER hardcode a tunable. Reward amounts, radius, speed, currency ids, durations, entity
          types, block materials, colours: all in the enchant's settings: block, read with
          enchants.getSettings(id) INSIDE onProc so /pinna reload picks up changes.
        - GLOWING: only call setGlowing(EdColor) with one of the 16 vanilla chat colours. The 9
          extended EdColor values CRASH the viewer's connection. When in doubt use AQUA or RED.
        - SPAWN THREAD: every EdLib packet entity can be created and spawned ASYNCHRONOUSLY (in an
          asyncSafe onProc, a goal runnable or executor.async) — falling blocks, armor stands, slimes,
          zombies, displays, NPCs, TNT, ModelEngine models, everything. The ONLY exception is the
          ENDER DRAGON: its constructor fires a Bukkit phase event Paper requires to be synchronous,
          so do createEntity + spawnInMine inside EdLibAPI.getExecutor().sync(...), then animate and
          move it off-thread as usual.
        - PARTICLE ENUM NAMES DIFFER BY VERSION. Use the names of the paper-api you compile against:
          1.20.4 has REDSTONE / BLOCK_CRACK / EXPLOSION_LARGE / SMOKE_LARGE, 1.21+ renamed them to
          DUST / BLOCK / EXPLOSION_EMITTER / LARGE_SMOKE. The examples here use the 1.20.4 names.
        - Cooldowns belong in the config: set cooldown-ticks in the enchant yaml instead of writing
          your own rate limiter — it is applied before onProc is ever called.

        ============================================================================
        HOW TO ADD THE ENCHANT (tell the user this AFTER you write the Java)
        ============================================================================
        An API enchant needs TWO files created on the server (besides your compiled plugin jar).
        Tell the user to create both, then run /pinna reload (or restart):

        1) The enchant config — plugins/PinnaPrison/enchants/<id>.yml  (the <id> MUST match your
           registerEnchant id). This is what makes the enchant exist, buyable and able to proc:
        \`\`\`yaml
        enabled: true          # false = the enchant is never registered (how you trim the list)
        color:
          primary: '&4'        # used by {prim-color} in name/lore
          secondary: '&c'      # used by {sec-color}
        starting-level: 0
        max-chance: 5          # max proc chance % (reached at max level)
        # always-max-chance: true   # every level procs at max-chance (a "procs every block" enchant)
        max-level: 1000        # 0 = UNLIMITED (never maxes out) — then use chance-per-level below
        # chance-per-level: 0.01    # +0.01% per level instead of spreading max-chance over max-level;
                                    # required for an unlimited enchant, capped at max-chance (or 100%)
        # proc-blocks: 25000        # DETERMINISTIC alternative to a chance: one activation per N blocks
                                    # mined, scaling with the level (level 2 = every 12,500). The nice way
                                    # to configure very rare enchants; boosters/crystals/prestige still
                                    # shorten the interval. 0 = use the normal chance system.
        material: NETHERITE_PICKAXE   # icon material (a Bukkit Material)
        model-data: -1         # custom model data of the icon, for resource packs (-1 = none)
        type: 'api'            # ALWAYS 'api' for a registered APIEnchant
        display-name: 'Explosion'
        cooldown-ticks: 100    # minimum ticks between procs (0 = none) — use this instead of your own limiter
        refundable: true       # can players refund levels (enchants.refund-return-percent)?
        # ALWAYS include a proc-message so it is configurable. Send it from onProc with
        # enchants.sendProcMessage(player, "<id>", "{placeholder}", value, ...). Players can mute it
        # globally (/settings) or per-enchant (upgrade menu) and sendProcMessage respects that.
        # Supports colour codes, PlaceholderAPI and %pinnaprison_notation_<number>%.
        proc-message: '&c&lBOOM! &7Explosion blasted &a{blocks} &7blocks!'
        requirement:           # optional: gate buying it behind a leveling/currency
          economy: 'pickaxelevel'
          amount: 10
        # chain: tokengreed    # optional COMBO: this enchant stops proccing on block breaks and instead
                               # rolls its chance every time 'tokengreed' procs (also accepts
                               # chain: { enchant: tokengreed }). Your Java needs no changes.
        reward:                # optional bonus currency per block this enchant sweeps
          type: blocks         # 'blocks' (default) = only the normal block income; or a currency id
          per-block: '0'       # math + PlaceholderAPI + {level} aware
        # The settings: block holds YOUR enchant's custom config. Read it in onProc with
        # enchants.getSettings("<id>").getString/getDouble/getInt/getBoolean/getLong. Put anything here.
        settings:
          radius: 3
          radius-per-level: 0.001
          affect-autosell: true
          affect-tokengreed: true
          affect-block-currencies: false
        cost:
          currency: tokens
          starting-cost: 100
          increase-cost-by: 500
          # is-exponential: true      # exponential cost curve instead of linear
          # exponential-growth: 1.05
        prestige:              # optional: remove this whole block for no prestige
          enabled: true
          max-prestige: 5
          max-chance-per-prestige: 1   # +1% max chance per prestige
          # amount-scalar:             # for enchants that already proc every block, prestige pays out
          #   start: 0.2               # in the AMOUNT instead: +0.2x at prestige 1 ...
          #   increase-per-prestige: 0.2
          reset-level: true
          requirements:
            tokens:
              type: currency
              amount: 500000
              remove: true
              increase-cost-by: 500000   # cost added per prestige already earned
        \`\`\`

        2) A GUI item so players can see/buy/upgrade it — add an entry under items: in
           plugins/PinnaPrison/guis/token-enchants.yml (or gem-enchants.yml). The custom-item type
           'enchant' wires the button to your enchant id and the upgrade menu:
        \`\`\`yaml
          explosion-enchant:
            custom-item:
              type: 'enchant'
              enchant: 'explosion'            # your enchant id
              upgrade-gui: 'upgrade-enchant'  # opens the buy/upgrade menu on click
            material: '{material}'            # uses the enchant's configured material
            custom-model-data: '{model-data}' # uses the enchant's configured model-data
            slot: 12
            name: '&c&lExplosion &b&lEnchant %pinnaprison_enchant_prestige_stars_explosion%'
            lore:
              - '&7Blast a sphere of blocks when you mine.'
              - '&r'
              - '&f&lInformation:'
              - ' &b| &fLevel: &a%pinnaprison_notation_{level}% &8/ &c%pinnaprison_notation_{max-level}%'
              - ' &b| &fPrice: &c%pinnaprison_notation_{cost}% &4Tokens'
              - ' &b| &fChance: &b{chance}%'
              - '&r'
              - '{status}'      # CLICK TO UPGRADE / MAXED / locked, filled in automatically
        \`\`\`
        GUI item placeholders filled by the 'enchant' custom item: {material}, {model-data}, {level},
        {max-level}, {cost}, {chance}, {status}. Anywhere you can also use PlaceholderAPI:
        %pinnaprison_enchant_level_<id>%, %pinnaprison_enchant_chance_<id>%,
        %pinnaprison_enchant_chance_onein_<id>%, %pinnaprison_enchant_prestige_stars_<id>%,
        %pinnaprison_enchant_activations_<id>%, %pinnaprison_notation_<number>%,
        %pinnaprison_variable_<name>%, %pinnaprison_currency_balance_<id>%,
        %pinnaprison_boosters_names_<economy>%, %pinnaprison_mine_...%.

        Final message to the user (after creating an enchant):
        "I created the <Name> enchant. To install it:
         1. Drop your compiled plugin jar in plugins/ (it depends on PinnaPrison).
         2. Create plugins/PinnaPrison/enchants/<id>.yml with the config above.
         3. Add the GUI item above to plugins/PinnaPrison/guis/token-enchants.yml (or gem-enchants.yml).
         4. Run /pinna reload (or restart). Buy it from the enchants menu and start mining!"
    `
};
