module.exports = {
    name: 'EdTools',
    description: 'API to access EdTools features: packet-based regen zones (crop/mine farming zones), custom API enchants with full proc animations, currencies (incl. block currencies and external-plugin currencies), levelings, backpacks + autosell, sell items, boosters (incl. live boost providers), omnitools (crop-tool / pickaxe-tool), tool skins, lucky blocks and config-driven GUIs — plus the low-level EdLib API for packet-based fake entities, display styling, ModelEngine/MythicMobs models, mob variants, packet worlds and goal-based AI used to build crazy animated farming/mining enchants.',
    pluginId: 'EdTools',
    systemDownloadURL: `
        https://raw.githubusercontent.com/CodellaAI/codella-documentations/main/lib/EdTools-API.jar
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
            <!-- EdTools main API -->
            <dependency>
                <groupId>es.edwardbelt</groupId>
                <artifactId>edtools-api</artifactId>
                <version>1.0</version>
                <scope>system</scope>
                <systemPath>\${basedir}/lib/EdTools-API.jar</systemPath>
            </dependency>

            <!-- EdLib low-level API (packet entities, displays, models, goals) -->
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
         * EdTools API Overview
         * Two system dependencies:
         *
         * EdLib-API.jar (es.edwardbelt.edlib.iapi):
         * - Low-level, packet-based server functionality (no real entities/blocks ever exist)
         * - Fake entity creation + manipulation (EdEntity), block/item/text displays with full
         *   display styling, armor-stand arm posing, real players as client-side passengers,
         *   mob variants, ModelEngine models with animations, MythicMobs lookup
         * - Goal-based AI for entity movement (EdGoal + impl goals)
         * - Action bars, XP bars, boss bars, per-player block packets, packet worlds (EdWorld)
         * - Cross-version (1.20.3 -> 1.26) NMS abstraction
         * - EVERYTHING in EdLib is packets, so it ALL runs fine ASYNCHRONOUSLY
         *
         * EdTools-API.jar (es.edwardbelt.edgens.iapi):
         * - High-level EdTools integration: regen zones + sessions, enchants, currencies,
         *   levelings, backpacks, sell items, boosters, omnitools, lucky blocks, GUIs
         * - Register custom API enchants with full proc/animation behaviour
         * - Break + reward blocks exactly like a real player break (backpack, autosell,
         *   block currencies, lucky blocks, other enchants — each one a flag you control)
         * - Bridge external economies in, register live boost providers, read/patch player data
         *
         * NOTE ON PACKAGES: EdTools' API package is es.edwardbelt.edgens.iapi (the plugin's
         * internal name is "edgens"), while the plugin/jar/folder is called EdTools. That is not a
         * typo — always import es.edwardbelt.edgens.iapi.*.
         */

        plugin.yml: add only EdTools as a 'depend' (EdLib's API ships inside the EdTools jar):
        \`\`\`
        name: MyEnchants
        version: 1.0
        main: com.example.MyEnchants
        api-version: '1.20'
        depend: [EdTools]
        \`\`\`

        ============================================================================
        !!! GOLDEN RULES — READ THIS BEFORE WRITING ANY CODE !!!
        ============================================================================
        These are not style preferences. Breaking any of them produces a broken enchant.

        1) onProc IS CALLED ASYNCHRONOUSLY, AND MUST STAY THAT WAY. EdTools breaks blocks on an
           async worker (a Netty/worker thread, never the main thread). Everything an enchant
           normally does is packet or data work and is safe there: mineBlockAsPlayer, EdLib
           entities/goals/displays, currency changes, per-player particles and sounds. Hopping to
           the main thread for every proc destroys TPS. Only touch the Bukkit scheduler when you
           genuinely need the real world / real entities / inventories.

        2) PARTICLES AND SOUNDS ARE PACKETS, SO THEY ARE ASYNC TOO.
           player.spawnParticle(...) and player.playSound(...) only build and send a packet to that
           one player's connection — call them straight from the async proc thread. Never schedule
           a sync task just for FX. (EdTools' own built-in enchants do exactly this.)

        3) A ZONE HAS NO REAL BLOCKS. A regen zone is a per-player packet layout: the world is
           empty/untouched and every player sees their own fake blocks. NEVER use
           world.getBlockAt(...), block.setType(...) or Bukkit block breaks. The ONLY way to break
           and reward a block is EdToolsZonesAPI#mineBlockAsPlayer (or its blacklist/whitelist
           overloads), which claims the block atomically, drops the sell item into the backpack,
           pays block currencies, rolls lucky blocks and regenerates on schedule.

        4) EVERYTHING YOU SPAWN IS PER-PLAYER. EdLib entities are packet entities: add ONLY the
           proc'ing player as a watcher (entity.addWatcher(player); entity.spawn()) and remove them
           when the animation ends. The enchant's show belongs to the player who procced it — other
           players in the zone must not see it (their own layout is different anyway).

        5) ALWAYS DESPAWN, TWICE. Give every entity BOTH an end-of-animation remove() (goal
           endRunnable) AND a fail-safe timed remove() in case the player leaves the zone, logs out
           or the goal is force-stopped. A leaked packet entity stays on the client forever.

        6) RESPECT THE PLAYER'S TOGGLES.
             enchantAPI.isEnchantEnabled(uuid, id)        -> the player turned this enchant off
             enchantAPI.isEnchantMessageEnabled(uuid, id) -> the player muted its proc message
           EdTools already skips onProc for a disabled enchant, but you MUST gate your proc message
           on isEnchantMessageEnabled before sending it.

        7) NEVER HARDCODE A TUNABLE. Radius, amounts, durations, entity types, materials, colours,
           messages: all of them live in the enchant's own yml (settings: / proc-message:) which the
           server owner edits. Read them INSIDE onProc so /edtools reload picks up the change (see
           "READING YOUR ENCHANT CONFIG" below — external API enchants are NOT re-read for you).

        8) SCALE WITH THE LEVEL. enchantAPI.getEnchantLevel(uuid, id) is a double and can be huge
           (max-level is commonly 1000+). Put the per-level factor in settings:, never in code, and
           always clamp the result (radius, entity count, duration) so a level-1,000,000 player
           cannot spawn 10,000 entities.

        9) CENTRE YOUR POSITIONS. Block positions are integers; entities and particles want the
           block CENTRE, so add (0.5, 0.5, 0.5) (or (0.5, 0, 0.5) for something standing on it).

        10) THE ENCHANT ONLY EXISTS IF ITS YML EXISTS. registerEnchant(id, ...) does nothing unless
            plugins/EdTools/enchants/<id>.yml is present (deleting the yml is how an owner disables
            an API enchant). Always tell the user to create that file — see "HOW TO ADD THE ENCHANT".

        ============================================================================
        ENTRY POINT
        ============================================================================
        EdToolsAPI interface: es.edwardbelt.edgens.iapi
        Static: void setInstance(EdToolsAPI), EdToolsAPI getInstance()
        Instance (all sub-APIs):
        EdToolsEnchantAPI     getEnchantAPI()
        EdToolsZonesAPI       getZonesAPI()
        EdToolsCurrencyAPI    getCurrencyAPI()
        EdToolsLevelingAPI    getLevelingAPI()
        EdToolsBackpackAPI    getBackpackAPI()
        EdToolsSellAPI        getSellAPI()
        EdToolsBoostersAPI    getBoostersAPI()
        EdToolsOmniToolAPI    getOmniToolAPI()
        EdToolsLuckyBlocksAPI getLuckyBlocksAPI()
        EdToolsGuisAPI        getGuisAPI()
        Inner: class InstanceHolder { public static EdToolsAPI INSTANCE; }

        The instance is set while EdTools enables, so with depend: [EdTools] it is ready in your
        onEnable():
        \`\`\`java
        import es.edwardbelt.edgens.iapi.EdToolsAPI;

        @Override
        public void onEnable() {
            EdToolsAPI api = EdToolsAPI.getInstance();
            if (api == null) {                       // EdTools failed to load
                getLogger().severe("EdTools not available, disabling.");
                getServer().getPluginManager().disablePlugin(this);
                return;
            }
            api.getEnchantAPI().registerEnchant("harvest-comet", new HarvestCometEnchant(this));
        }
        \`\`\`

        APIPair<A, B> class: es.edwardbelt.edgens.iapi — the two-value return type used by the
        zones API. new APIPair<>(a, b); A getValue0(); B getValue1().

        ============================================================================
        EdToolsZonesAPI — regen zones, sessions and BREAKING BLOCKS
        ============================================================================
        es.edwardbelt.edgens.iapi.EdToolsZonesAPI — the most important API for enchants.

        A "regen zone" is a region whose blocks are sent as PACKETS. Every player in a session sees
        their own private layout, picks which block type (crop/ore) they farm, and breaking is
        tracked per player. A session is either GLOBAL (shared zone, per-player layout) or ALONE
        (private instance).

        Sessions:
        void joinGlobalSession(Player player, String zoneId)
        void joinAloneSession(Player player, String zoneId)   // private session of that zone
        void leaveSession(Player player)
        boolean isPlayerInSession(Player player)
        String getPlayerZoneId(Player player)                 // null when not in a session
        String getPlayerZoneSessionType(Player player)        // "global" / "alone", null when none

        Zone info + progression:
        List<String> getZoneIds()                             // every loaded zone id
        List<Vector> getZoneLocations(String zoneId)          // every breakable position of the zone
        String getPlayerProgressionZoneId(Player player)      // session zone, or the LAST zone entered
                                                              // (works at spawn, unlike getPlayerZoneId)
        List<String> getZoneBlocksTypes(String zoneId)        // the zone's blocks sections, in config order
        int getZoneBlocksTypeCount(String zoneId)             // 0 for an unknown zone
        void setPlayerBlocksTypeZone(Player player, String zoneId, String blocksType)
        String getPlayerBlocksTypeZone(Player player, String zoneId)   // the section the player selected
        int getPlayerBlocksTypeNumberZone(Player player, String zoneId) // 1-based position of that section,
                                                              // 0 when unknown — the "how far has this
                                                              // player come" number to price things by

        The player's layout:
        Map<Vector, Material> getPlayersLoadedBlocks(Player player)
          // The player's OWN fake-block layout (block position -> material). NULL when the player
          // is not in a zone session. It contains the whole layout, ALREADY-BROKEN positions
          // included — mineBlockAsPlayer simply returns null for those, so filter by result, and
          // never assume a key is still standing.
          // NOTE: with server-blocks mode enabled a player outside a zone can still mine (the
          // session is the real world). getPlayersLoadedBlocks returns null there while
          // mineBlockAsPlayer keeps working — so when it is null, build your targets from
          // geometry around data.getPosition() instead of bailing out.

        Breaking blocks (THE reward path — never touch the world yourself):
        APIPair<Material, String> mineBlockAsPlayer(Player player, Vector position, String toolId,
                boolean affectEnchants, boolean affectSell, boolean affectBlockCurrencies,
                boolean affectLuckyBlocks)
        APIPair<Material, String> mineBlockAsPlayer(..., List<String> blacklistedEnchants)
                // same, but these enchant ids may NOT proc from this break (ignored when
                // affectEnchants is false). Put your OWN id in it if you ever pass affectEnchants
                // true, or your enchant can proc itself recursively.
        APIPair<Material, String> mineBlockAsPlayerWhitelist(..., List<String> whitelistedEnchants)
                // same, but ONLY these enchant ids may proc (null/empty = no restriction).

          Returns the broken block as APIPair<Material, String>: getValue0() = the block material,
          getValue1() = the sell-item id it produced (may be null when the block has no sell item).
          Returns NULL when nothing was broken: no session, the position is not in the player's
          layout, it was already broken, or a listener cancelled EdToolsBreakBlockEvent. ALWAYS
          null-check and count only non-null results — that count is your "blocks broken" number.

          The flags, and what to pass from an enchant:
            affectEnchants        -> false (DEFAULT). true makes every other enchant roll on each
                                     block you break: enchant storms, recursion, TPS death.
            affectSell            -> true. Puts the sell item into the player's backpack (or sells
                                     it directly when they have autosell on). This is the payout.
            affectBlockCurrencies -> false (DEFAULT). true also pays the block currencies
                                     (crop-blocks / mine-blocks / total-blocks), which are meant to
                                     count blocks the player mined by hand.
            affectLuckyBlocks     -> true is fine (lucky blocks may drop from your blocks).
          Expose all four in settings: so the owner can change them without a recompile.

          ALWAYS pass the toolId you were given (data.getToolId()), never a hardcoded "crop-tool":
          that is what keeps zone/tool bookkeeping correct.

        ============================================================================
        EdToolsEnchantAPI — enchant levels, chances, toggles, registration
        ============================================================================
        es.edwardbelt.edgens.iapi.EdToolsEnchantAPI
        void registerEnchant(String id, APIEnchant enchant)   // id MUST equal enchants/<id>.yml
        List<String> getEnchantList()                         // every loaded enchant id (config + API)
        double getEnchantLevel(UUID uuid, String enchant)
        void addEnchantLevel(UUID uuid, String enchant, double level)
        void removeEnchantLevel(UUID uuid, String enchant, double level)
        double getEnchantChance(UUID uuid, String enchant)    // 0-100, level + prestige + boosters applied
        double getEnchantMaxLevel(String enchant)
        double getEnchantStartingLevel(String enchant)
        double getEnchantMaxChance(String enchant)
        void triggerCustomEnchant(Player player, String enchant, Material material, Vector position)
                // force a proc, no chance roll
        boolean tryTriggerCustomEnchant(Player player, String enchant, Material material, Vector position)
                // roll the chance; true when it procced
        boolean isEnchantEnabled(UUID uuid, String enchant)   // player's on/off toggle
        void setEnchantEnabled(UUID uuid, String enchant, boolean enabled)
        boolean isEnchantMessageEnabled(UUID uuid, String enchant)  // proc-message mute
        void setEnchantMessageEnabled(UUID uuid, String enchant, boolean enabled)

        ============================================================================
        WRITING AN API ENCHANT
        ============================================================================
        APIEnchant interface: es.edwardbelt.edgens.iapi.enchant
          void onProc(Player player, EnchantData data)
          // Called ASYNC, only when the enchant actually procced. You never check the chance, the
          // level, the cooldown or the player's toggle — EdTools did all of that already.

        EnchantData abstract class: es.edwardbelt.edgens.iapi.enchant
          String getToolId()
        CustomEnchantData extends EnchantData: es.edwardbelt.edgens.iapi.enchant
          Material getMaterial()   // the block that was broken
          Vector getPosition()     // its block position (integer coords — add 0.5 to centre)
          String getSellItem()     // the sell-item id it produced (nullable)
          String getToolId()       // e.g. "crop-tool" / "pickaxe-tool"
        Enchants currently only proc on a block break, so data is ALWAYS a CustomEnchantData:
        cast it (pattern-match) and return early if it is not.

        Skeleton:
        \`\`\`java
        public class MyEnchant implements APIEnchant {
            @Override
            public void onProc(Player player, EnchantData raw) {
                if (!(raw instanceof CustomEnchantData data)) return;   // block breaks only
                // async thread — packets and data only
            }
        }
        \`\`\`

        READING YOUR ENCHANT CONFIG (settings: and proc-message:)
        The EdTools API does not hand you the enchant's yml, so read it yourself from EdTools'
        data folder — and re-read it inside onProc (cached with the file's lastModified) so
        /edtools reload applies instantly. This matters: on reload EdTools re-reads its OWN
        enchants but keeps the wrapper it built for an externally registered API enchant, so a
        cost/chance change needs a restart (or your plugin calling registerEnchant again) while
        anything you read yourself updates immediately.
        \`\`\`java
        // plugins/EdTools/enchants/<id>.yml — owners may move it into a visual sub-folder, so
        // search recursively for <id>.yml under the enchants folder.
        private File findConfig(String id) {
            File root = new File(Bukkit.getPluginManager().getPlugin("EdTools").getDataFolder(), "enchants");
            java.util.Deque<File> stack = new java.util.ArrayDeque<>(java.util.List.of(root));
            while (!stack.isEmpty()) {
                File[] children = stack.pop().listFiles();
                if (children == null) continue;
                for (File child : children) {
                    if (child.isDirectory()) stack.push(child);
                    else if (child.getName().equalsIgnoreCase(id + ".yml")) return child;
                }
            }
            return null;
        }
        \`\`\`
        Then YamlConfiguration.loadConfiguration(file), read root.getConfigurationSection("settings")
        for your knobs and root.getString("proc-message") for the message. Cache the parsed config
        and reload it when file.lastModified() changes.

        THE PROC MESSAGE
        \`\`\`java
        String message = config.getString("proc-message");
        if (message != null && !message.isEmpty()
                && api.getEnchantAPI().isEnchantMessageEnabled(player.getUniqueId(), id)) {
            message = message.replace("{blocks}", String.valueOf(broken));
            player.sendMessage(ChatColor.translateAlternateColorCodes('&', message));
            // If PlaceholderAPI is installed you may also run it through PlaceholderAPI.setPlaceholders.
        }
        \`\`\`
        Never build proc chat by hand in code — always from proc-message so the owner can edit it.

        ============================================================================
        EdToolsCurrencyAPI — currencies, block currencies, external economies
        ============================================================================
        es.edwardbelt.edgens.iapi.EdToolsCurrencyAPI
        List<String> getCurrencyList()                        // ids of every loaded currency
        double getCurrency(UUID uuid, String currency)
        void setCurrency(UUID uuid, String currency, double amount)
        void addCurrency(UUID uuid, String currency, double amount)
        void addCurrency(UUID uuid, String currency, double amount, boolean affectBoosters)
                // affectBoosters=true applies the player's boosters/attributes/skin multipliers and
                // fires EdToolsCurrencyAddEvent. Use true for gameplay rewards, false for refunds
                // and admin corrections.
        void removeCurrency(UUID uuid, String currency, double amount)
        boolean isCurrency(String currency)                   // configured OR registered external
        boolean isExternal(String currency)                   // backed by another plugin
        double getMaxCurrencyValue(String currency)           // 0 = unlimited
        double getStartingCurrencyValue(String currency)
        String getCurrencyName(String currency)               // display name (use it in messages)
        String getBlockCurrencyByTool(String toolId)          // "crop-tool" -> "crop-blocks", or null
        void registerExternalCurrency(ExternalCurrency currency)

        Default currencies of a stock install: money, farm-coins, mine-coins (spendable) and the
        BLOCK CURRENCIES crop-blocks, mine-blocks, total-blocks — a currency file with
        block-currency: true auto-increments by 1 on every block the player breaks by hand, and
        block-currency-tool: '<toolId>' restricts it to one tool (empty = every tool). That is
        EdTools' "blocks mined" counter; read it with getCurrency(uuid, "crop-blocks") or
        %edtools_currency_balance_crop-blocks%.

        ExternalCurrency interface: es.edwardbelt.edgens.iapi.currency — bridge YOUR plugin's
        economy in so its id works anywhere an EdTools currency id does (enchant costs, sell
        prices, leveling costs, boosters):
          String getId(); double getBalance(UUID); void setBalance(UUID, double);
          void addBalance(UUID, double); void removeBalance(UUID, double)
        Register it after EdTools has enabled. EdTools stores nothing — every call is delegated to
        you, from any thread (implementations MUST be thread-safe). The display name comes from
        external-currencies.yml (matched by id).

        ============================================================================
        EdToolsLevelingAPI — leveling tracks
        ============================================================================
        es.edwardbelt.edgens.iapi.EdToolsLevelingAPI
        List<String> getLevelList()                           // every loaded leveling id
        double getLevel(UUID uuid, String levelId)
        void setLevel(UUID uuid, String levelId, double level)
        void addLevel(UUID uuid, String levelId, double level)
        void removeLevel(UUID uuid, String levelId, double level)
        boolean isLevel(String level)
        double getStartingLevel(String level)
        boolean isAutomaticLeveling(String level)             // levels up on its own when affordable
        String getLevelName(String level)                     // display name
        List<String> getForEachRewards(String level)          // commands run on every level up
        Map<Double, List<String>> getIntervalRewards(String level)  // every N levels
        Map<Double, List<String>> getSpecificRewards(String level)  // at exact levels

        ============================================================================
        EdToolsBackpackAPI — the backpack that collects farmed/mined items
        ============================================================================
        es.edwardbelt.edgens.iapi.EdToolsBackpackAPI
        ItemStack getPlayerBackpackInInventory(Player player) // the backpack item, if they carry one
        Map<String, Double> getBackpackItems(UUID uuid)       // sell-item id -> stored amount
        double getBackpackWeight(UUID uuid)                   // how full it is right now
        void sellBackpackItems(Player player)                 // sell everything in it
        boolean isInventoryPickupEnabled(UUID uuid)           // items skip the backpack and go to the inventory
        void setInventoryPickup(UUID uuid, boolean enabled)
        int withdrawBackpackItem(Player player, String itemId, int amount)  // MAIN THREAD; returns amount withdrawn
        void withdrawBackpackItems(Player player)             // MAIN THREAD; withdraw everything that fits
        void upgradeBackpackAsPlayer(Player player)           // buy the next tier for them
        void setBackpackUpgrade(UUID uuid, String upgrade)
        String getBackpackUpgrade(UUID uuid)                  // current tier id
        String getBackpackNextUpgrade(UUID uuid)              // null when maxed
        Set<String> getBackpackUpgrades()                     // every tier id
        double getBackpackUpgradeMultiplier(String upgrade)
        double getBackpackUpgradeCost(String upgrade)
        String getBackpackUpgradeCurrency(String upgrade)
        double getBackpackUpgradeSize(String upgrade)
        (The two withdraw methods move real ItemStacks into the inventory — those two, and only
        those two, must run on the main thread.)

        ============================================================================
        EdToolsSellAPI — sell items and the reward summary
        ============================================================================
        es.edwardbelt.edgens.iapi.EdToolsSellAPI
        void sellItem(UUID uuid, String itemId, double amount)      // sell N of a sell-item id (item-prices.yml)
        void addSellSummary(UUID uuid, String currencyId, double amount)  // add to the on-screen summary
        double getSellSummary(UUID uuid, String currencyId)
        Sell items are the ids configured in item-prices.yml (e.g. wheat-tier1) — the same ids that
        come back as getValue1() of mineBlockAsPlayer and as CustomEnchantData#getSellItem().
        When you pay a bonus currency by hand and want it to appear in the player's reward summary,
        call addSellSummary with the same amount.

        ============================================================================
        EdToolsBoostersAPI — multipliers, and live boost providers
        ============================================================================
        es.edwardbelt.edgens.iapi.EdToolsBoostersAPI
        double getBoosterValueByEconomy(UUID uuid, String economy)  // total multiplier on a currency
        double getBoosterValueGlobalEnchants(UUID uuid)             // total enchant-chance multiplier
        List<String> getActiveBoosters(UUID uuid)
        List<String> getActiveBoosters(UUID uuid, String economy)   // "" = global enchant boosters
        boolean existsBooster(UUID uuid, String boosterId)
        void removeBooster(UUID uuid, String boosterId)
        String getBoosterName(UUID uuid, String boosterId)
        String getBoosterCurrency(UUID uuid, String boosterId)
        boolean isBoosterEnchantType(UUID uuid, String boosterId)
        double getBoosterMultiplier(UUID uuid, String boosterId)
        long getBoosterDuration(UUID uuid, String boosterId)        // millis
        long getBoosterRemainingTime(UUID uuid, String boosterId)   // millis
        void setBoosterMultiplier(UUID uuid, String boosterId, double multiplier)
        void setBoosterDuration(UUID uuid, String boosterId, long duration)
        void setBoosterEnchantBooster(UUID uuid, String boosterId, boolean enchantBooster)
        void setBoosterEconomy(UUID uuid, String boosterId, String economy)
        void setBoosterTimeLeft(UUID uuid, String boosterId, long timeLeft)
        void addBooster(UUID uuid, String boosterId, String boosterName, String economy,
                        double multiplier, long duration, boolean enchantBooster, boolean saveDB)
        void registerBoostProvider(String id, BoostProvider provider)
        void unregisterBoostProvider(String id)

        BoostProvider interface: es.edwardbelt.edgens.iapi.booster — a LIVE boost source, queried on
        every boosted currency gain and enchant proc-chance lookup. Never persisted, applies even
        while the boosters feature is off, vanishes the moment you unregister — perfect for "while
        the player holds a streak" or "while an event is running". All methods are defaulted:
          double getEconomyBoost(UUID uuid, String economy)   // extra above 1x (0.25 = +25%);
                                                              // a currency id boosts earnings,
                                                              // an enchant id boosts that enchant's chance
          double getEnchantBoost(UUID uuid)                   // extra on EVERY enchant's proc chance
          Collection<ProviderBoost> getBoostViews(UUID uuid, String economy)  // display only
          Collection<ProviderBoost> getEnchantBoostViews(UUID uuid)           // display only
        These run on the hot mining path: cached map lookups only, no I/O, no contended locks,
        thread-safe. ProviderBoost (same package): new ProviderBoost(String displayName, double
        displayMultiplier) — the multiplier is the EFFECTIVE factor (+50% -> 1.5), and the entry
        shows up in the boosters GUI and %edtools_boosters_names_<economy>%.

        ============================================================================
        EdToolsOmniToolAPI — the crop-tool / pickaxe-tool items
        ============================================================================
        es.edwardbelt.edgens.iapi.EdToolsOmniToolAPI
        List<String> getOmniToolList()                        // e.g. [crop-tool, pickaxe-tool]
        void loadTool(String toolId, ConfigurationSection toolSec)  // register a tool from your own config
        boolean isItemOmniTool(ItemStack item)
        String getOmniToolId(ItemStack item)                  // null when it isn't an omnitool
        ItemStack getOmniToolItem(Player owner, String toolId)     // build the tool item for a player
        ItemStack getOmniToolFromPlayer(Player player)        // the omnitool they are holding/carrying
        void updateTool(Player player, ItemStack item)        // refresh its name/lore/skin after a change
        String getOmniToolGui(String toolId)                  // the tool's own menu id, null if unknown
        An omnitool carries its owner and its enchants; tool ids are what the enchant yml's tool:
        field and every zone/enchant call refer to.

        ============================================================================
        EdToolsLuckyBlocksAPI
        ============================================================================
        es.edwardbelt.edgens.iapi.EdToolsLuckyBlocksAPI
        ItemStack getLuckyBlockItem(String id, Player owner)  // build a lucky block item
        boolean isLuckyBlock(ItemStack item)
        boolean isLuckyBlockUnlocked(ItemStack item)          // already opened?
        void updateLuckyBlock(Player player, ItemStack item)  // refresh its display

        ============================================================================
        EdToolsGuisAPI — EdTools' config-driven menus
        ============================================================================
        es.edwardbelt.edgens.iapi.EdToolsGuisAPI
        void openGui(Player player, String gui)
        void openGui(Player player, String gui, Map<String, String> placeholders)  // {key} -> value in the yml
        void closeGui(Player player)
        void loadGui(String guiId, File guiFile)              // register a menu from YOUR plugin's folder
        Opening an inventory touches Bukkit UI — call openGui/closeGui on the MAIN thread.

        ============================================================================
        EVENTS (es.edwardbelt.edgens.iapi.event)
        ============================================================================
        Register a normal Bukkit listener. Three of these fire on the ASYNC break pipeline — do not
        touch the Bukkit world/inventories inside them without hopping to the main thread.

        EdToolsBreakBlockEvent (ASYNC, Cancellable) — a player broke a block in a zone, before
        anything is given for it. Cancelling puts the block back: no drop, no currencies, no
        enchants, no lucky blocks.
          Player getPlayer(); Material getMaterial(); String getSoldItem(); String getToolId();
          Vector getPosition(); boolean isCancelled(); void setCancelled(boolean)

        EdToolsCurrencyAddEvent (ASYNC) — currency is being added with boosters enabled. Change the
        payout before it lands:
          UUID getUuid(); String getCurrency(); double getAmount(); double getMultiplier();
          void setCurrency(String); void setAmount(double); void setMultiplier(double);
          void addMultiplier(double)     // stack your own bonus on top

        EdToolsEnchantTryProcEvent (ASYNC) — an enchant is about to roll its chance:
          Player getPlayer(); String getEnchant(); double getChance(); void setChance(double)

        EdToolsOpenToolMenuEvent (MAIN THREAD, Cancellable) — the player right-clicked their tool and
        the menu is about to open. Cancel it to keep vanilla right-click behaviour, or swap the menu:
          Player getPlayer(); String getToolId(); boolean isSneaking();
          String getGuiId(); void setGuiId(String); boolean isCancelled(); void setCancelled(boolean)

        EdToolsSwapToolEvent (MAIN THREAD) — the player's omnitool swapped to another tool in place
        (zone auto-swap, swap command, selector GUI). Only fired when the tool really changed:
          Player getPlayer(); String getPreviousToolId(); String getToolId()

        All five expose the Bukkit pair: HandlerList getHandlers() and static HandlerList
        getHandlerList().

        ============================================================================
        WORKED EXAMPLE — a complete API enchant ("Harvest Comet")
        ============================================================================
        A comet flies in from the sky, slams into a random block near the break, shatters a sphere
        of crops, pays the player and prints the configured proc message. Everything runs async,
        every entity is per-player and double-despawned, every number comes from the yml.

        \`\`\`java
        package com.example.edtoolsaddon;

        import es.edwardbelt.edgens.iapi.APIPair;
        import es.edwardbelt.edgens.iapi.EdToolsAPI;
        import es.edwardbelt.edgens.iapi.enchant.APIEnchant;
        import es.edwardbelt.edgens.iapi.enchant.CustomEnchantData;
        import es.edwardbelt.edgens.iapi.enchant.EnchantData;
        import es.edwardbelt.edlib.iapi.EdLibAPI;
        import es.edwardbelt.edlib.iapi.entity.EdEntity;
        import es.edwardbelt.edlib.iapi.entity.EdFallingBlock;
        import es.edwardbelt.edlib.iapi.entity.goal.impl.EdGoalParabolicMove;
        import org.bukkit.*;
        import org.bukkit.configuration.ConfigurationSection;
        import org.bukkit.configuration.file.YamlConfiguration;
        import org.bukkit.entity.EntityType;
        import org.bukkit.entity.Player;
        import org.bukkit.util.Vector;

        import java.io.File;
        import java.util.*;
        import java.util.concurrent.ThreadLocalRandom;

        public class HarvestCometEnchant implements APIEnchant {

            private static final String ID = "harvest-comet";

            private final EdToolsAPI api = EdToolsAPI.getInstance();
            private File configFile;
            private long lastModified;
            private ConfigurationSection settings;
            private String procMessage;

            @Override
            public void onProc(Player player, EnchantData raw) {
                if (!(raw instanceof CustomEnchantData data)) return;   // block breaks only
                reloadConfigIfChanged();

                World world = player.getWorld();
                UUID uuid = player.getUniqueId();
                double level = api.getEnchantAPI().getEnchantLevel(uuid, ID);

                // ---- every tunable from settings:, scaled by level and CLAMPED ----
                double radius = Math.min(
                        settings.getDouble("radius", 3) + level * settings.getDouble("radius-per-level", 0.002),
                        settings.getDouble("max-radius", 8));
                int    height     = settings.getInt("spawn-height", 18);
                long   travelMs   = settings.getLong("travel-ms", 900);
                String blockName  = settings.getString("comet-material", "MAGMA_BLOCK");
                String bonusEco   = settings.getString("bonus-currency", "farm-coins");
                double bonusEach  = settings.getDouble("bonus-per-block", 0);
                boolean affectSell        = settings.getBoolean("affect-sell", true);
                boolean affectLucky       = settings.getBoolean("affect-lucky-blocks", true);
                boolean affectCurrencies  = settings.getBoolean("affect-block-currencies", false);

                Material comet = Material.matchMaterial(blockName);
                if (comet == null) comet = Material.MAGMA_BLOCK;

                // ---- pick the impact point from the player's OWN layout ----
                Vector impact = pickTarget(player, data.getPosition(), radius);
                Vector centre = impact.clone().add(new Vector(0.5, 0.5, 0.5));
                Vector start  = centre.clone().add(new Vector(0, height, 0));

                // ---- the comet: a packet falling block, watched by this player only ----
                EdFallingBlock entity = (EdFallingBlock) EdLibAPI.getInstance()
                        .createEntity(EntityType.FALLING_BLOCK, start.toLocation(world));
                entity.setFallingBlock(comet);
                entity.setGravity(false);
                entity.addWatcher(player);
                entity.spawn();

                player.playSound(start.toLocation(world), Sound.ENTITY_BLAZE_SHOOT, 1f, 0.6f);

                // ---- fly it down with a goal; trail + impact are packets too ----
                EdGoalParabolicMove goal = new EdGoalParabolicMove(centre, 4, travelMs);
                goal.setEachTickRunnable(() -> {
                    Vector pos = entity.getPosition();
                    player.spawnParticle(Particle.FLAME, pos.toLocation(world), 6, 0.15, 0.15, 0.15, 0.01);
                    player.spawnParticle(Particle.SMOKE_NORMAL, pos.toLocation(world), 3, 0.1, 0.1, 0.1, 0.01);
                });
                goal.setEndRunnable(() -> {
                    entity.remove();
                    impact(player, world, data, centre, radius,
                           affectSell, affectCurrencies, affectLucky, bonusEco, bonusEach);
                });
                entity.addGoal(goal);

                // ---- rule 5: fail-safe despawn if the goal never ends (player left / logged out) ----
                EdLibAPI.getExecutor().asyncLater(entity::remove,
                        (travelMs / 50L) + 40L, "harvest-comet-cleanup");
            }

            /** The explosion: break a sphere, pay the bonus, message the player. */
            private void impact(Player player, World world, CustomEnchantData data, Vector centre,
                                double radius, boolean affectSell, boolean affectCurrencies,
                                boolean affectLucky, String bonusEco, double bonusEach) {
                player.playSound(centre.toLocation(world), Sound.ENTITY_GENERIC_EXPLODE, 1f, 1.2f);
                player.spawnParticle(Particle.EXPLOSION_LARGE, centre.toLocation(world), 4, radius / 3, 0.4, radius / 3, 0);

                int broken = 0;
                int r = (int) Math.ceil(radius);
                double radiusSq = radius * radius;
                for (int x = -r; x <= r; x++) {
                    for (int y = -r; y <= r; y++) {
                        for (int z = -r; z <= r; z++) {
                            if (x * x + y * y + z * z > radiusSq) continue;
                            Vector pos = new Vector(centre.getBlockX() + x, centre.getBlockY() + y, centre.getBlockZ() + z);
                            // affectEnchants = false (rule: never chain-proc), sell = true
                            APIPair<Material, String> result = api.getZonesAPI().mineBlockAsPlayer(
                                    player, pos, data.getToolId(),
                                    false, affectSell, affectCurrencies, affectLucky);
                            if (result != null) broken++;      // null = nothing was there
                        }
                    }
                }
                if (broken == 0) return;

                if (bonusEach > 0) {
                    double amount = bonusEach * broken;
                    api.getCurrencyAPI().addCurrency(player.getUniqueId(), bonusEco, amount, true);
                    api.getSellAPI().addSellSummary(player.getUniqueId(), bonusEco, amount);  // show it in the summary
                }

                sendProcMessage(player, "{blocks}", String.valueOf(broken));
            }

            /** A random unbroken-looking block of the player's layout near the break. */
            private Vector pickTarget(Player player, Vector origin, double radius) {
                Map<Vector, Material> layout = api.getZonesAPI().getPlayersLoadedBlocks(player);
                if (layout == null || layout.isEmpty()) return origin.clone();   // server-blocks mode
                List<Vector> candidates = new ArrayList<>();
                double radiusSq = radius * radius * 4;
                for (Vector pos : layout.keySet()) {
                    if (pos.distanceSquared(origin) <= radiusSq) candidates.add(pos);
                    if (candidates.size() >= 256) break;
                }
                if (candidates.isEmpty()) return origin.clone();
                return candidates.get(ThreadLocalRandom.current().nextInt(candidates.size())).clone();
            }

            private void sendProcMessage(Player player, String... replacements) {
                if (procMessage == null || procMessage.isEmpty() || !player.isOnline()) return;
                if (!api.getEnchantAPI().isEnchantMessageEnabled(player.getUniqueId(), ID)) return;  // muted
                String message = procMessage;
                for (int i = 0; i + 1 < replacements.length; i += 2) {
                    message = message.replace(replacements[i], replacements[i + 1]);
                }
                player.sendMessage(ChatColor.translateAlternateColorCodes('&', message));
            }

            /** Re-reads enchants/<id>.yml when it changed, so /edtools reload applies live. */
            private void reloadConfigIfChanged() {
                if (configFile == null || !configFile.exists()) configFile = findConfig(ID);
                if (configFile == null) {
                    settings = new YamlConfiguration();      // never NPE: fall back to defaults
                    return;
                }
                long modified = configFile.lastModified();
                if (settings != null && modified == lastModified) return;
                lastModified = modified;
                YamlConfiguration root = YamlConfiguration.loadConfiguration(configFile);
                ConfigurationSection section = root.getConfigurationSection("settings");
                settings = section != null ? section : new YamlConfiguration();
                procMessage = root.getString("proc-message");
            }

            private static File findConfig(String id) {
                org.bukkit.plugin.Plugin edtools = Bukkit.getPluginManager().getPlugin("EdTools");
                if (edtools == null) return null;
                Deque<File> stack = new ArrayDeque<>(List.of(new File(edtools.getDataFolder(), "enchants")));
                while (!stack.isEmpty()) {
                    File[] children = stack.pop().listFiles();
                    if (children == null) continue;
                    for (File child : children) {
                        if (child.isDirectory()) stack.push(child);
                        else if (child.getName().equalsIgnoreCase(id + ".yml")) return child;
                    }
                }
                return null;
            }
        }
        \`\`\`

        And the plugin main class:
        \`\`\`java
        public class MyEnchants extends JavaPlugin {
            @Override
            public void onEnable() {
                EdToolsAPI api = EdToolsAPI.getInstance();
                if (api == null) {
                    getLogger().severe("EdTools is not available — disabling.");
                    getServer().getPluginManager().disablePlugin(this);
                    return;
                }
                api.getEnchantAPI().registerEnchant("harvest-comet", new HarvestCometEnchant());
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
          //     ITEM_DISPLAY  -> createItemDisplay(location, matrix, item)
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
        void sendActionbar(Player player, String message)
        void sendXPBar(Player player, float progress, int level)
        void hidePlayer(Player viewer, Player target)
        void showPlayer(Player viewer, Player target)
        void sendBlocks(Player player, Map<Vector, Material> blocks) // raw fake blocks for ONE player — how you disguise a zone's blocks before shattering them
        void sendBossBar(Player player, UUID bossBarId, String title, float progress, String color)
        void updateBossBarTitle(Player player, UUID bossBarId, String title)
        void updateBossBarProgress(Player player, UUID bossBarId, float progress)
        void removeBossBar(Player player, UUID bossBarId)

        EdEntity interface: es.edwardbelt.edlib.iapi.entity
        Integer getId(); UUID getUUID(); EntityType getType(); Object getEntity()
        void addWatcher(Player player); void removeWatcher(Player player); Collection<Player> getWatchers()
          // ^ in an EdTools enchant the watcher is ALWAYS just the proc'ing player.
        void damageEffect(); void spawn(); void spawnForPlayer(Player player); void remove(); void removeForPlayer(Player player)
        void setGravity(boolean hasGravity); void setInFire(boolean inFire)
        void setEquipment(EntityEquipmentSlot slot, ItemStack item)
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
          // hitbox of that size spawns and follows the model, and getId() returns the HITBOX entity id.
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
        void setModelOffset(double x, double y, double z) // offsets the rendered model (anchor, parts, hitbox) relative to the logical tp position WITHOUT moving the floating name. Blocks at scale 1; scales with setScale. Applies on the next teleport
        void tp(double x, double y, double z)       // teleport whole model (anchor, parts, name, hitbox), keeps rotation
        void tp(double x, double y, double z, float yaw, float pitch) // + rotate in the same packet; in smooth mode position AND rotation interpolate together (fluid banking turns)
        void syncParts()                            // snap every part to the main entity's position — call each tick when a goal moves the main entity in smooth mode

        Goal System (es.edwardbelt.edlib.iapi.entity.goal) — drive packet-entity movement
        EdGoal abstract class — void start()/init()/forceStop(); boolean isRunning()/shouldExecute(); void tick();
          void setEndRunnable(Runnable); void setStartRunnable(Runnable); void setEachTickRunnable(Runnable);
          EdEntity getEntity(); void setEntity(EdEntity); boolean isForceStopped()
          // The goal ticks on an EdLib ASYNC repeating task (1 tick period). endRunnable fires when
          // shouldExecute() turns false — but NOT when the goal was forceStop()ed, which is exactly why
          // every animation also needs the asyncLater fail-safe despawn (rule 5).
        Goal impls (es.edwardbelt.edlib.iapi.entity.goal.impl):
        EdGoalMove(Vector moveGoal, double speed) — straight-line move (speed = blocks per tick); setAffectY/setSendRotationEachTick/setInvertRotation/setSendRotation
        EdGoalArchMove(Vector end, double speed, long duration)
        EdGoalParabolicMove(Vector end, double height, long duration) — teleports each tick
        EdGoalDisplayParabolicMove(Vector end, double height, long duration, int keyframeTicks, Matrix4f baseTransform)
          // parabolic flight for DISPLAY entities with client-side interpolation: instead of teleporting
          // each tick (EdGoalParabolicMove, can look choppy) the transformation translation is keyframed
          // every keyframeTicks and the client glides between keyframes — perfectly smooth. baseTransform
          // = the display's standing transformation (scale/centering; null = identity). The underlying
          // entity never moves — use getVisualPosition() for where viewers see it (particle trails).
          // 2-4 keyframeTicks is smooth.
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
        Use async/asyncLater for every packet effect, fail-safe despawn and timer; use sync ONLY when you
        must touch the real Bukkit world/entities/inventory (e.g. backpack withdraw, opening a GUI).
        For timed entity sequences prefer goal runnables (setEachTickRunnable / setEndRunnable) or
        EdGoalDelay over manual timers.

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
        PLACEHOLDERS (PlaceholderAPI, prefix %edtools_...%)
        ============================================================================
        Use them in GUI items, lore, proc messages and any other plugin. Append _formatted (default
        notation from config.yml) or _formatted_single (separators, e.g. 1,000,000) to a number.
        Enchants:   %edtools_enchant_level_<id>%, %edtools_enchant_chance_<id>%,
                    %edtools_enchant_maxlevel_<id>%, %edtools_enchant_cost_<id>_<levels>%,
                    %edtools_enchant_maxcost_<id>%, %edtools_enchant_maxlevels_<id>%,
                    %edtools_enchant_material_<id>%, %edtools_enchant_name_<id>%,
                    %edtools_enchant_status_<id>% (enabled/disabled),
                    %edtools_enchant_currencyname_<id>%, %edtools_enchant_proc_message_<id>%
        Prestige:   %edtools_enchant_prestige_<id>%, %edtools_enchant_maxprestige_<id>%,
                    %edtools_enchant_prestige_enabled_<id>%, %edtools_enchant_prestige_stars_<id>%,
                    %edtools_enchant_prestige_chancebonus_<id>%,
                    %edtools_enchant_prestige_canprestige_<id>%,
                    %edtools_enchant_prestige_requirements_<id>%
        Currencies: %edtools_currency_balance_<currency>%, %edtools_currency_name_<currency>%
                    (block currencies: crop-blocks / mine-blocks / total-blocks = blocks mined)
        Leveling:   %edtools_leveling_level_<id>%, %edtools_leveling_bar_<id>%,
                    %edtools_leveling_progress_<id>%, %edtools_leveling_currencyrequired_<id>%
        Backpack:   %edtools_backpack_size%, %edtools_backpack_maxsize%, %edtools_backpack_nextsize%,
                    %edtools_backpack_multiplier%, %edtools_backpack_nextmultiplier%,
                    %edtools_backpack_cost%, %edtools_backpack_maxed%, %edtools_backpack_currencyname%,
                    %edtools_backpack_autosell%, %edtools_backpack_pickup%
        Boosters:   %edtools_boosters_global_<currency>%, %edtools_boosters_global_enchants%,
                    %edtools_boosters_names_<currency>%, %edtools_boosters_names_enchants%
        Summary:    %edtools_summary_<currency>%, %edtools_summary_rate_<currency>%,
                    %edtools_summary_gained_<currency>%
        Zones:      %edtools_zone_in%, %edtools_zone_crop_selected_<zoneId>%
        Tools:      %edtools_tool_displayname_<toolId>%, %edtools_toolskin_*% (skins),
                    %edtools_attribute_level%, %edtools_attribute_boost_<economy>%
        Utility:    %edtools_notation_<number>%, %edtools_singlenotation_<number>%,
                    %edtools_abbrevnotation_<number>%, %edtools_parse_<number>%,
                    %edtools_calc_<expression>%, %edtools_random_<min>|<max>%,
                    %edtools_randomwithdecimals_<decimals>_<min>|<max>%,
                    %edtools_haspermission_<permission>%

        ============================================================================
        BEST PRACTICES (checklist before you ship an enchant)
        ============================================================================
        - onProc stays ASYNC and packet/data only: mineBlockAsPlayer, EdLib entities/goals,
          currency changes, per-player particles/sounds. Hop to the main thread only for the real
          world / inventories (backpack withdraw, opening a GUI).
        - Break + reward ONLY through EdToolsZonesAPI#mineBlockAsPlayer. Never touch the real world
          — a zone has no real blocks. Count only non-null returns.
        - Default affectEnchants to FALSE (no chain-procs) and affectBlockCurrencies to FALSE
          (that counter is for hand-mined blocks); affectSell TRUE is the payout. Expose all four
          flags in settings:.
        - Always pass the toolId from CustomEnchantData#getToolId(), never a hardcoded tool id.
        - Every packet entity: addWatcher(the proc'ing player) only, then spawn(). Give it BOTH an
          endRunnable remove() and an EdLibAPI.getExecutor().asyncLater fail-safe remove().
        - Particles/sounds are per-player packets: player.spawnParticle / player.playSound straight
          from the async thread, to the proc'ing player only. The more FX, the better the enchant.
        - Chat only from the configured proc-message, gated on
          enchantAPI.isEnchantMessageEnabled(uuid, id). Never hardcode proc chat.
        - Scale with enchantAPI.getEnchantLevel(uuid, id), put the per-level factor in settings:,
          and CLAMP the result (max-radius, max-entities, max-duration) — levels reach the thousands.
        - Centre positions with +0.5 before spawning entities or playing FX.
        - NEVER hardcode a tunable: amounts, radius, speed, currency ids, durations, entity types,
          materials, colours all live in settings: and are read INSIDE onProc so /edtools reload
          applies them.
        - Cooldowns belong in the config: set cooldown-ticks in the enchant yml instead of writing
          your own rate limiter — EdTools applies it before onProc is ever called.
        - GLOWING: only call setGlowing(EdColor) with one of the 16 vanilla chat colours. The other
          9 CRASH the viewer's connection. When in doubt use AQUA or RED.
        - SPAWN THREAD: every EdLib packet entity can be created and spawned asynchronously —
          falling blocks, armor stands, mobs, displays, NPCs, TNT, ModelEngine models. The ONLY
          exception is the ENDER DRAGON, whose constructor fires a Bukkit event Paper requires to be
          sync: create + spawn it inside EdLibAPI.getExecutor().sync(...), then animate it async.
        - PARTICLE ENUM NAMES DIFFER BY VERSION. Use the names of the paper-api you compile against:
          1.20.4 has REDSTONE / BLOCK_CRACK / EXPLOSION_LARGE / SMOKE_NORMAL, 1.21+ renamed them to
          DUST / BLOCK / EXPLOSION_EMITTER / SMOKE. The examples here use the 1.20.4 names.
        - If the enchant is for crops use tool: 'crop-tool' and a farm currency (farm-coins); for
          mining use tool: 'pickaxe-tool' and mine-coins. The tool id must exist in
          plugins/EdTools/tools/.

        ============================================================================
        HOW TO ADD THE ENCHANT (tell the user this AFTER you write the Java)
        ============================================================================
        An API enchant needs TWO things created on the server besides your compiled jar.

        1) The enchant config — plugins/EdTools/enchants/<id>.yml. The file name MUST match the id
           you passed to registerEnchant. Without it the enchant is never registered (and deleting
           it later is how an owner disables it). It may be moved into a sub-folder for tidiness.
        \`\`\`yaml
        max-chance: 25            # proc chance % at max level
        # always-max-chance: true # every level procs at max-chance ("procs constantly" enchant)
        starting-level: 0
        max-level: 1000
        material: MAGMA_BLOCK     # icon material (a Bukkit Material) for the GUI
        type: 'api'               # ALWAYS 'api' for a registered APIEnchant
        tool: 'crop-tool'         # crop-tool (farming) or pickaxe-tool (mining)
        display-name: 'Harvest Comet'
        cooldown-ticks: 100       # minimum ticks between procs (0 = none) — use this, not your own limiter
        prim-color: '&6'          # optional colours used by the tool's enchant lore format
        sec-color: '&e'

        cost:
          currency: farm-coins    # any currency id (farm-coins, mine-coins, money, an external one...)
          starting-cost: 2500
          increase-cost-by: 750
          # remove-currency: true # deduct the cost on upgrade (default true)

        # YOUR knobs. Anything you read in onProc goes here — values support PlaceholderAPI and
        # math expressions, so admins can even scale them with the level themselves.
        settings:
          radius: 3
          radius-per-level: 0.002
          max-radius: 8
          spawn-height: 18
          travel-ms: 900
          comet-material: MAGMA_BLOCK
          bonus-currency: farm-coins
          bonus-per-block: 0
          affect-sell: true
          affect-lucky-blocks: true
          affect-block-currencies: false

        # Shown when it procs. Players can mute it per enchant, and your code must respect that.
        proc-message: '&6&l[!] &7Your &e&lHarvest Comet &7shattered &6{blocks} crops&7!'

        # OPTIONAL prestige block — delete it for no prestige.
        prestige:
          enabled: true
          max-prestige: 5
          max-chance-per-prestige: 1     # +1% max chance per prestige
          reset-level: true
          requirements:
            farm-coins:
              type: currency             # 'currency' or 'level' (a leveling track)
              amount: 500000
              remove: true               # consume it (currencies default true, levels default false)
              scale-with-prestige: true  # amount * next prestige level (default true)

        # OPTIONAL extra config-driven actions run right after your Java (give-eco, message,
        # particle, spawn-entity, break-blocks, sell-item, command, delay, loop...).
        # actions:
        #   1:
        #     type: give-eco
        #     currency: farm-coins
        #     amount: '10*{edtools_enchant_level_harvest-comet}'
        \`\`\`

        2) A GUI item so players can see and upgrade it — add an entry under contents: in the tool's
           menu, plugins/EdTools/guis/crop.yml (farming) or pickaxe.yml (mining):
        \`\`\`yaml
          harvest-comet-enchant:
            slots: '14'
            material: '%edtools_enchant_material_harvest-comet%'
            name: '&6&lHARVEST COMET &d&lENCHANT'
            lore:
              - '&8ACTIVATION CHANCE &d%edtools_enchant_chance_harvest-comet%%'
              - '&3'
              - '&9&lDESCRIPTION:'
              - '&3 &d| &3Call down a comet that shatters'
              - '&3 &d| &3a sphere of crops on impact.'
              - '&3'
              - '&9&lINFORMATION:'
              - '&3 &d| &fLevel: &e%edtools_enchant_level_harvest-comet_formatted_single% &8/ &c%edtools_enchant_maxlevel_harvest-comet_formatted_single%'
              - '&3 &d| &fPrice: &e%edtools_enchant_cost_harvest-comet_1_formatted_single% &6%edtools_enchant_currencyname_harvest-comet%'
              - '&3'
              - '&9[CLICK HERE TO UPGRADE THIS ENCHANT]'
            any-click-actions:
              - '[menu] upgrade-enchant enchant harvest-comet tool-gui crop'
        \`\`\`
        (The [menu] action opens EdTools' shared upgrade menu for your enchant and returns to the
        crop menu. Use tool-gui pickaxe for a mining enchant.)

        Final message to the user (after creating an enchant):
        "I created the <Name> enchant. To install it:
         1. Drop your compiled plugin jar in plugins/ (it depends on EdTools).
         2. Create plugins/EdTools/enchants/<id>.yml with the config above.
         3. Add the GUI item above to plugins/EdTools/guis/crop.yml (or pickaxe.yml).
         4. Restart the server (a full restart, so the enchant is registered with the new config).
            Buy it from the tool menu and start farming!"
    `
};
