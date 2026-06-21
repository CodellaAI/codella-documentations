module.exports = {
    name: 'PinnaPrison',
    description: 'API to access PinnaPrison features: packet-based private mines, pickaxe enchants (custom API enchants), currencies, levelings, rebirth, backpacks, autosell, boosters, crystals, abilities, attributes, autominers, bombs, drills and GUIs — plus the low-level EdLib API for packet-based fake entities, custom models and goal-based AI used to build crazy animated mine enchants.',
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
                <groupId>es.edwardbelt.pinnaprison</groupId>
                <artifactId>api</artifactId>
                <version>1.0</version>
                <scope>system</scope>
                <systemPath>\${basedir}/lib/PinnaPrison-API.jar</systemPath>
            </dependency>

            <!-- EdLib low-level API (packet entities, models, goals) -->
            <dependency>
                <groupId>es.edwardbelt.edlib</groupId>
                <artifactId>api</artifactId>
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
         * - Low-level, packet-based server functionality (no real entities/blocks)
         * - Fake entity creation + manipulation (EdEntity), block/item displays, models
         * - Goal-based AI for entity movement (EdGoal + impl goals)
         * - Action bars, XP bars, boss bars, per-player block packets
         * - Cross-version (1.20.3 -> 1.26) NMS abstraction
         * - Everything in EdLib runs fine asynchronously (it is all packets)
         *
         * PinnaPrison-API.jar (es.edwardbelt.pinnaprison.iapi):
         * - High-level prison integration: mines, enchants, currencies, levelings,
         *   rebirth, backpacks, autosell, boosters, crystals, abilities, attributes,
         *   autominers, bombs, drills, pickaxe and GUIs
         * - Register custom pickaxe (mine) enchants with full proc/animation behaviour
         * - Break + reward blocks exactly like vanilla mining
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
        ENTRY POINT
        ============================================================================
        PinnaPrisonAPI interface: es.edwardbelt.pinnaprison.iapi
        Grab it AFTER PinnaPrison has enabled (e.g. your onEnable, or a delayed task). getInstance()
        returns null until PinnaPrison finished enabling.
        Static Methods:
        static void setInstance(PinnaPrisonAPI instance)
        static PinnaPrisonAPI getInstance()
        Instance Methods (sub-services):
        CurrencyService getCurrencies()
        EnchantService getEnchants()
        LevelingService getLeveling()
        PickaxeService getPickaxe()
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

        Example:
        \`\`\`java
        PinnaPrisonAPI api = PinnaPrisonAPI.getInstance();
        api.getCurrencies().addBalanceBoosted(uuid, "tokens", BigDecimal.valueOf(1000));
        \`\`\`

        ============================================================================
        SERVICES (es.edwardbelt.pinnaprison.iapi.service)
        ============================================================================
        Note: amounts are java.math.BigDecimal. ids are config file names (e.g. "tokens",
        "money", "gems", "rankupxp", "pickaxelevel", "rebirth"). All services are thread-safe.

        CurrencyService:
        Set<String> getCurrencyIds()
        boolean exists(String currencyId)
        String getDisplayName(String currencyId)
        boolean isBlockCurrency(String currencyId)              // granted per block mined
        BigDecimal getBalance(UUID playerId, String currencyId)
        void setBalance(UUID playerId, String currencyId, BigDecimal amount)
        void addBalance(UUID playerId, String currencyId, BigDecimal amount)
        void removeBalance(UUID playerId, String currencyId, BigDecimal amount)
        void addBalanceBoosted(UUID playerId, String currencyId, BigDecimal amount) // applies booster/crystal/attribute/rebirth multipliers — use this for enchant rewards
        BigDecimal getBoostMultiplier(UUID playerId, String currencyId)
        boolean has(UUID playerId, String currencyId, BigDecimal amount)

        EnchantService: (see the ENCHANT SYSTEM section for registerEnchant + onProc)
        void registerEnchant(String enchantId, APIEnchant enchant)
        Set<String> getEnchantIds()
        boolean exists(String enchantId)
        String getDisplayName(String enchantId)
        BigDecimal getMaxLevel(String enchantId)
        ConfigurationSection getSettings(String enchantId)     // the enchant's settings: block — read YOUR custom config values here (currency id, amount, animation knobs, ...). null if none. Read it in onProc (it is reloaded by /pinna reload).
        String getProcMessage(String enchantId)                // the configured proc-message (raw), or null
        void sendProcMessage(Player player, String enchantId, Object... replacements) // sends proc-message honouring mute toggles + colour + PAPI + {placeholder},value pairs. The easy, configurable proc message for every API enchant.
        Map<String, BigDecimal> getPlayerEnchants(UUID playerId)
        BigDecimal getLevel(UUID playerId, String enchantId)
        void setLevel(UUID playerId, String enchantId, BigDecimal level)
        void addLevel(UUID playerId, String enchantId, BigDecimal levels)
        void removeLevel(UUID playerId, String enchantId, BigDecimal levels)
        BigDecimal getChance(UUID playerId, String enchantId)   // effective proc chance 0-100
        BigDecimal getCost(UUID playerId, String enchantId, BigDecimal levels)
        BigDecimal getMaxLevelsAffordable(UUID playerId, String enchantId)
        int getPrestige(UUID playerId, String enchantId)
        void setPrestige(UUID playerId, String enchantId, int prestige)
        boolean canPrestige(UUID playerId, String enchantId)
        void prestige(Player player, String enchantId)
        boolean isDisabled(UUID playerId, String enchantId)     // the player's on/off toggle
        boolean isMessagesDisabled(UUID playerId)               // /settings — honour before chat
        boolean isSoundsDisabled(UUID playerId)                 // /settings — honour before sounds
        boolean isParticlesDisabled(UUID playerId)              // /settings — honour before particles
        boolean isProcMessageDisabled(UUID playerId, String enchantId)
        void tryProcEnchants(Player player, EnchantData data)   // rolls ALL the player's enchants
        void procEnchant(Player player, String enchantId, EnchantData data) // forces one (no chance roll)

        LevelingService: (rankup, pickaxelevel, rebirth, ...)
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

        PickaxeService:
        boolean isPickaxe(ItemStack item)
        ItemStack createPickaxe(Player player)
        ItemStack getPickaxe(Player player)
        void givePickaxe(Player player)
        void updatePickaxe(Player player)
        int getEfficiency()

        MineService: (private mines are PACKET-BASED and per-player; live in one shared void world)
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
        // The break methods pay the player EXACTLY like mining. Flags:
        //   affectBlockCurrencies = grant rankup/pickaxe xp etc per block
        //   affectAutosell        = collect blocks into backpack / autosell income
        //   affectTokenGreed      = also pay the Token Greed enchant bonus
        // They only touch the player's OWN joined mine, never the real world. Thread-safe.
        int breakBlocks(Player player, Collection<Vector> positions, boolean affectBlockCurrencies, boolean affectAutosell, boolean affectTokenGreed)
        int breakLayer(Player player, int y, boolean affectBlockCurrencies, boolean affectAutosell, boolean affectTokenGreed)
        int breakSphere(Player player, Vector center, double radius, boolean affectBlockCurrencies, boolean affectAutosell, boolean affectTokenGreed)
        boolean breakBlock(Player player, Vector position, boolean affectBlockCurrencies, boolean affectAutosell, boolean affectTokenGreed, boolean affectEnchants) // affectEnchants=true can chain-proc; use carefully
        Collection<Player> getMineViewers(Player player)        // digger + co-op members + visitors — target packet FX at all of them
        void spawnInMine(Player player, EdEntity entity)        // show a packet entity to the WHOLE mine (use instead of addWatcher+spawn)
        void despawnInMine(Player player, EdEntity entity)      // untrack + despawn (use instead of EdEntity#remove)
        void visit(Player visitor, Player owner)
        void goToOwnMine(Player player)

        BackpackService:
        String getTierId(UUID playerId)
        String getNextTierId(UUID playerId)
        BigDecimal getSize(UUID playerId)
        double getMultiplier(UUID playerId)
        Map<String, BigDecimal> getItems(UUID playerId)
        BigDecimal getWeight(UUID playerId)
        void addBlocks(Player player, Material material, int count)   // store mined blocks (or autosell)
        void sell(Player player)
        void upgrade(Player player)
        boolean isAutosellEnabled(UUID playerId)
        void setAutosell(UUID playerId, boolean enabled)
        boolean isBackpackItem(ItemStack item)
        ItemStack createBackpackItem(Player player)
        void openGui(Player player)

        SellService:
        boolean isAutosellEnabled(UUID playerId)
        void setAutosell(UUID playerId, boolean enabled)
        boolean hasPrice(Material material)
        Map<String, BigDecimal> sell(UUID playerId, Material material, BigDecimal amount) // returns per-currency gains

        BoosterService: (personal + global currency-income / enchant-chance multipliers)
        boolean isEnabled()
        double getEconomyBoost(UUID playerId, String economy)         // 0 = none
        double getEnchantBoost(UUID playerId)
        void giveBooster(UUID playerId, String economy, double multiplier, boolean enchantBooster, long durationSeconds)
        void removeBooster(UUID playerId, String boosterId)
        void addGlobalBooster(String economy, double multiplier, boolean enchantBooster, long durationSeconds) // 0s = permanent
        boolean isBoosterItem(ItemStack item)
        String getBoosterId(ItemStack item)
        ItemStack createBoosterItem(String id)
        void claim(Player player, ItemStack boosterItem)

        CrystalService: (pickaxe crystals = per-key multipliers)
        double getMultiplier(UUID playerId, String key)
        int getSlots(UUID playerId)
        void setSlots(UUID playerId, int slots)
        void addSlots(UUID playerId, int amount)
        void removeSlots(UUID playerId, int amount)
        boolean isCrystalItem(ItemStack item)
        ItemStack createCrystalItem(String id)
        void apply(Player player, ItemStack crystalItem)

        RebirthService:
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

        AttributeService:
        int getLevel(UUID playerId)
        double getEconomyBoost(UUID playerId, String currencyId)
        double getEnchantBoost(UUID playerId)

        AbilityService:
        boolean exists(String abilityId)
        boolean isUnlocked(UUID playerId, String abilityId)
        void unlock(Player player, String abilityId)
        String getSelectedId(UUID playerId)
        boolean isSelected(UUID playerId, String abilityId)
        void toggleSelect(Player player, String abilityId)
        boolean isAutoCast(UUID playerId)
        void setAutoCast(UUID playerId, boolean value)
        long getCooldownRemaining(UUID playerId, String abilityId)
        void activateSelected(Player player, boolean auto)
        boolean isAbilityItem(ItemStack item)
        ItemStack createAbilityItem(String abilityId)
        void applyItem(Player player, ItemStack abilityItem)

        AutominerService:
        int getMaxMiners()
        Set<String> getEnchantIds()
        int getUnlockedSlots(UUID playerId)
        void addSlots(UUID playerId, int amount)
        boolean isSlotUnlocked(UUID playerId, String minerId)
        double getBattery(UUID playerId)
        void addBattery(UUID playerId, double amount)
        int getEnchantLevel(UUID playerId, String minerId, String enchantId)
        BigDecimal getUpgradeCost(UUID playerId, String minerId, String enchantId, int levels)
        int getMaxLevelsAffordable(UUID playerId, String minerId, String enchantId)
        void upgradeEnchant(Player player, String minerId, String enchantId, int levels, boolean max)
        boolean isSummoned(UUID playerId, String minerId)
        void summon(Player player, String minerId)
        void despawn(Player player, String minerId)

        BombService:
        boolean isEnabled()
        boolean isBombItem(ItemStack item)
        String getBombId(ItemStack item)
        ItemStack createBombItem(String id)
        void throwBomb(Player player, ItemStack bombItem)

        DrillService:
        boolean isEnabled()
        boolean isDrillItem(ItemStack item)
        String getDrillId(ItemStack item)
        ItemStack createDrillItem(String id)
        void useDrill(Player player, ItemStack drillItem)

        ============================================================================
        EVENTS (es.edwardbelt.pinnaprison.iapi.event)
        ============================================================================
        Base classes:
        PinnaPrisonEvent (abstract extends org.bukkit.event.Event) — auto async-detected. If
          isAsynchronous() is true, DO NOT touch the Bukkit world/entities in the listener; schedule a task.
        PinnaPlayerEvent (abstract extends PinnaPrisonEvent) — Player getPlayer(), UUID getPlayerId()
        Every event has the usual static HandlerList getHandlerList() and HandlerList getHandlers().

        BlockMineEvent (Cancellable) — a manual single-block dig, before removal/rewards (async, Netty thread)
          Vector getPosition(), Material getMaterial()  // cancel = restore block client-side + no rewards
        EnchantProcEvent (Cancellable) — an enchant procs, before its effect (async)
          String getEnchantId(), EnchantData getData()  // cancel = skip the effect
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

        ============================================================================
        ENCHANT SYSTEM — the main reason to use this API
        ============================================================================
        A custom enchant has TWO parts:
        1) BEHAVIOUR (your Java): implement APIEnchant#onProc and register it.
        2) CONFIG (a yaml file): plugins/PinnaPrison/enchants/<id>.yml with type: api — this defines
           chance, level, cost, prestige, display name, material, requirement. WITHOUT this file the
           enchant does not exist in-game (can't be bought, never rolls a chance).

        APIEnchant interface: es.edwardbelt.pinnaprison.iapi.enchant
        void onProc(Player player, EnchantData data)   // runs when the enchant procs
        default boolean asyncSafe()                     // default false
          - false (default): onProc is dispatched to the MAIN thread. Use if it touches the Bukkit
            world, real entities or inventories.
          - true: onProc runs on the async break thread (max throughput). Use ONLY if onProc does
            purely packet/data work: the MineService break methods, EdLib packet entities, currency
            changes, and per-player particles/sounds. This is what animated mine enchants should use.

        EnchantData interface: es.edwardbelt.pinnaprison.iapi.enchant.data — marker for trigger context.
        BlockBreakEnchantData class (implements EnchantData): the normal mining trigger.
          Vector getPosition()   // the mined block position (mine-world coords)
          Material getMaterial() // the mined block type
        Always: if (!(data instanceof BlockBreakEnchantData hit)) return;

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
            api.getEnchants().registerEnchant("comet", new CometEnchant(this));
        }
        \`\`\`
        Registration survives /pinna reload (the yaml is re-read each time).

        ----------------------------------------------------------------------------
        EXAMPLE 1 — Explosion (simple, packet-only, asyncSafe)
        ----------------------------------------------------------------------------
        \`\`\`java
        import es.edwardbelt.pinnaprison.iapi.PinnaPrisonAPI;
        import es.edwardbelt.pinnaprison.iapi.enchant.APIEnchant;
        import es.edwardbelt.pinnaprison.iapi.enchant.EnchantRegions;
        import es.edwardbelt.pinnaprison.iapi.enchant.data.BlockBreakEnchantData;
        import es.edwardbelt.pinnaprison.iapi.enchant.data.EnchantData;
        import es.edwardbelt.pinnaprison.iapi.service.EnchantService;
        import es.edwardbelt.pinnaprison.iapi.service.MineService;
        import org.bukkit.Particle;
        import org.bukkit.Sound;
        import org.bukkit.entity.Player;
        import org.bukkit.util.Vector;

        public class ExplosionEnchant implements APIEnchant {
            @Override public boolean asyncSafe() { return true; } // packets + data only

            @Override public void onProc(Player player, EnchantData data) {
                if (!(data instanceof BlockBreakEnchantData hit)) return;
                PinnaPrisonAPI api = PinnaPrisonAPI.getInstance();
                MineService mines = api.getMines();
                EnchantService enchants = api.getEnchants();
                Vector center = hit.getPosition().clone().add(new Vector(0.5, 0.5, 0.5));

                // Read the radius from the enchant's settings: block (admin-tunable). Default 3.
                org.bukkit.configuration.ConfigurationSection settings = enchants.getSettings("explosion");
                double radius = settings == null ? 3 : settings.getDouble("radius", 3);

                // Break + pay a sphere exactly like mining: blockCurrencies OFF, autosell ON, tokenGreed ON.
                int broken = mines.breakSphere(player, center, radius, false, true, true);
                if (broken <= 0) return;

                // Per-player FX, only the digger, only if they haven't muted them in /settings.
                if (!enchants.isSoundsDisabled(player.getUniqueId()))
                    player.playSound(toLoc(player, center), Sound.ENTITY_GENERIC_EXPLODE, 1f, 0.8f);
                if (!enchants.isParticlesDisabled(player.getUniqueId()))
                    player.spawnParticle(Particle.EXPLOSION_LARGE, toLoc(player, center), 3, 1, 1, 1, 0);

                // The configurable proc message (set proc-message in the yaml); honours mute toggles.
                enchants.sendProcMessage(player, "explosion", "{blocks}", String.valueOf(broken));
            }

            private org.bukkit.Location toLoc(Player p, Vector v) {
                return new org.bukkit.Location(PinnaPrisonAPI.getInstance().getMines().getMinesWorld(), v.getX(), v.getY(), v.getZ());
            }
        }
        \`\`\`

        ----------------------------------------------------------------------------
        EXAMPLE 2 — Jackhammer (break whole layers)
        ----------------------------------------------------------------------------
        \`\`\`java
        public class JackhammerEnchant implements APIEnchant {
            @Override public boolean asyncSafe() { return true; }
            @Override public void onProc(Player player, EnchantData data) {
                if (!(data instanceof BlockBreakEnchantData hit)) return;
                PinnaPrisonAPI.getInstance().getMines()
                    .breakLayer(player, hit.getPosition().getBlockY(), false, true, true);
            }
        }
        \`\`\`

        ----------------------------------------------------------------------------
        EXAMPLE 3 — Currency reward enchant, fully config-driven (settings: + proc-message)
        ----------------------------------------------------------------------------
        Reads the currency id and the (math + PlaceholderAPI aware, {level}-substituted) amount from
        the enchant's settings: block, then sends the configurable proc-message. NOTHING is hardcoded —
        the admin tunes the currency, amount and message in the yaml.
        \`\`\`java
        import es.edwardbelt.pinnaprison.iapi.PinnaPrisonAPI;
        import es.edwardbelt.pinnaprison.iapi.enchant.APIEnchant;
        import es.edwardbelt.pinnaprison.iapi.enchant.data.EnchantData;
        import es.edwardbelt.pinnaprison.iapi.service.CurrencyService;
        import es.edwardbelt.pinnaprison.iapi.service.EnchantService;
        import org.bukkit.configuration.ConfigurationSection;
        import org.bukkit.entity.Player;
        import java.math.BigDecimal;
        import java.util.UUID;

        public class GreedEnchant implements APIEnchant {
            private final String id;
            public GreedEnchant(String id) { this.id = id; }  // e.g. registerEnchant("tokengreed", new GreedEnchant("tokengreed"))

            @Override public boolean asyncSafe() { return true; } // pure data

            @Override public void onProc(Player player, EnchantData data) {
                PinnaPrisonAPI api = PinnaPrisonAPI.getInstance();
                EnchantService enchants = api.getEnchants();
                CurrencyService currencies = api.getCurrencies();
                UUID uuid = player.getUniqueId();

                // Read this enchant's custom config from its settings: block (reloaded by /pinna reload).
                ConfigurationSection settings = enchants.getSettings(id);
                if (settings == null) return;
                String currency = settings.getString("currency", "tokens");
                String amountExpr = settings.getString("amount", "1000 + {level}");

                // {level} + math + PlaceholderAPI -> a number. (Parse however you like; here a simple eval.)
                BigDecimal level = enchants.getLevel(uuid, id);
                BigDecimal amount = evaluate(amountExpr.replace("{level}", level.toPlainString()), player);

                currencies.addBalanceBoosted(uuid, currency, amount); // boosted = respects booster/crystal/rebirth
                // The configurable proc message: set proc-message in the yaml; this honours mute toggles for you.
                enchants.sendProcMessage(player, id, "{amount}", amount.toPlainString(), "{currency}", currency);
            }

            // Use your own math/PAPI evaluation; PinnaPrison's notation placeholders also work in the message.
            private BigDecimal evaluate(String expr, Player player) {
                try { return new BigDecimal(expr.trim()); } catch (Exception e) { return BigDecimal.ZERO; }
            }
        }
        \`\`\`
        Its settings: block in the yaml (see the HOW TO ADD section) would be e.g.:
        \`\`\`yaml
        proc-message: '&6Greed! &e+{amount} {currency}'
        settings:
          currency: tokens
          amount: '1000 + ({level} * 50)'
        \`\`\`

        ----------------------------------------------------------------------------
        EXAMPLE 4 — Comet (animated EdLib entity + impact) — the showpiece
        ----------------------------------------------------------------------------
        A burning falling block streaks down and slams into the mine, blasting a sphere. It uses the
        EdLib entity + a move goal; the goal's per-tick runnable spawns the trail and the end runnable
        does the impact. spawnInMine shows it to the whole mine; despawnInMine cleans it up.
        \`\`\`java
        import es.edwardbelt.edlib.iapi.EdLibAPI;
        import es.edwardbelt.edlib.iapi.entity.EdFallingBlock;
        import es.edwardbelt.edlib.iapi.entity.goal.impl.EdGoalMove;
        import es.edwardbelt.pinnaprison.iapi.PinnaPrisonAPI;
        import es.edwardbelt.pinnaprison.iapi.enchant.APIEnchant;
        import es.edwardbelt.pinnaprison.iapi.enchant.data.BlockBreakEnchantData;
        import es.edwardbelt.pinnaprison.iapi.enchant.data.EnchantData;
        import es.edwardbelt.pinnaprison.iapi.service.EnchantService;
        import es.edwardbelt.pinnaprison.iapi.service.MineService;
        import org.bukkit.*;
        import org.bukkit.entity.EntityType;
        import org.bukkit.entity.Player;
        import org.bukkit.util.Vector;

        public class CometEnchant implements APIEnchant {
            @Override public boolean asyncSafe() { return true; } // entities, goals and breaks are packets

            @Override public void onProc(Player player, EnchantData data) {
                if (!(data instanceof BlockBreakEnchantData hit)) return;
                EdLibAPI edlib = EdLibAPI.getInstance();
                MineService mines = PinnaPrisonAPI.getInstance().getMines();
                EnchantService enchants = PinnaPrisonAPI.getInstance().getEnchants();
                World world = mines.getMinesWorld();

                Vector impact = hit.getPosition().clone().add(new Vector(0.5, 0.5, 0.5));
                Vector spawn = impact.clone().add(new Vector(0, 16, 0));

                EdFallingBlock comet = (EdFallingBlock) edlib.createEntity(EntityType.FALLING_BLOCK,
                        new Location(world, spawn.getX(), spawn.getY(), spawn.getZ()));
                comet.setFallingBlock(Material.MAGMA_BLOCK);
                comet.setGravity(false);            // driven by the goal
                mines.spawnInMine(player, comet);   // visible to everyone in the mine

                EdGoalMove fall = new EdGoalMove(impact, 1.4); // fly to impact at 1.4 blocks/tick
                fall.setEachTickRunnable(() -> {
                    if (enchants.isParticlesDisabled(player.getUniqueId())) return;
                    Vector p = comet.getPosition();
                    player.spawnParticle(Particle.FLAME, p.getX(), p.getY(), p.getZ(), 4, 0.2, 0.2, 0.2, 0);
                });
                fall.setEndRunnable(() -> {
                    mines.despawnInMine(player, comet); // untrack + despawn
                    int broken = mines.breakSphere(player, impact, 3, false, true, true);
                    if (!enchants.isSoundsDisabled(player.getUniqueId()))
                        player.playSound(new Location(world, impact.getX(), impact.getY(), impact.getZ()),
                                Sound.ENTITY_GENERIC_EXPLODE, 1f, 0.8f);
                    if (broken > 0) player.sendMessage("§6☄ Comet smashed §e" + broken + " §6blocks!");
                });
                comet.addGoal(fall);

                // Fail-safe: if the player leaves mid-flight, despawn the comet after ~6s.
                EdLibAPI.getExecutor().asyncLater(() -> mines.despawnInMine(player, comet), 120, "comet-cleanup");
            }
        }
        \`\`\`

        ============================================================================
        EdLib API (es.edwardbelt.edlib.iapi) — packet entities, models, goals
        ============================================================================
        EdLibAPI interface: es.edwardbelt.edlib.iapi
        Static: void setInstance(EdLibAPI), EdLibAPI getInstance()
                TaskExecutor getExecutor(), void setExecutor(TaskExecutor)  // scheduler (see SCHEDULING below)
        Instance:
        EdModel getModel(String modelId)
        EdEntity createEntity(EntityType type, Location location)
        EdNPC createNPC(Location location, String name, String skinTexture, String skinSignature) // packet player NPC
        EdEntity createInteractionEntity(Location location, float width, float height)
        EdEntity createBlockDisplay(Location location, Matrix4f transformation, Material material)
        EdEntity createItemDisplay(Location location, Matrix4f transformation, String itemData, int[] customModelData, String nbtData)
        EdWorld createWorld()
        void sendActionbar(Player player, String message)
        void sendXPBar(Player player, float progress, int level)
        void hidePlayer(Player viewer, Player target)
        void showPlayer(Player viewer, Player target)
        void sendBlocks(Player player, Map<Vector, Material> blocks)
        void sendBossBar(Player player, UUID bossBarId, String title, float progress, String color)
        void updateBossBarTitle(Player player, UUID bossBarId, String title)
        void updateBossBarProgress(Player player, UUID bossBarId, float progress)
        void removeBossBar(Player player, UUID bossBarId)

        EdEntity interface: es.edwardbelt.edlib.iapi.entity
        Integer getId(); UUID getUUID(); EntityType getType(); Object getEntity()
        void addWatcher(Player player); void removeWatcher(Player player); Collection<Player> getWatchers()
        void damageEffect(); void spawn(); void spawnForPlayer(Player player); void remove(); void removeForPlayer(Player player)
        void setGravity(boolean hasGravity); void setInFire(boolean inFire)
        void setEquipment(EntityEquipmentSlot slot, ItemStack item)
        void playAnimation(EntityAnimation animation)
        void setSlimeSize(int size); void setSmall(); void setInvisible()
        void setDisplayName(String name); void setGlowing(EdColor color); float getNameHeight()
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
        void addGoal(EdGoal goal); void startNextGoal(); void onGoalComplete()
        Queue<EdGoal> getGoalQueue(); EdGoal getCurrentGoal(); void setCurrentGoal(EdGoal goal)
        void clearGoals(); void skipCurrentGoal()
        EdLivingEntity interface: es.edwardbelt.edlib.iapi.entity
        EdFallingBlock interface: Material getBlockMaterial(); void setFallingBlock(Material material)
        EdPrimedTNT interface: long getFuseTicks(); void setFuseTicks(long ticks); Material getMaterial(); void setMaterial(Material material)
        EdNPC interface (extends EdEntity): es.edwardbelt.edlib.iapi.entity — a packet player NPC
          String getProfileName(); void setSkin(String texture, String signature); void setSkinParts(byte);
          void setSecondLayerVisible(boolean); boolean isTabListed(); void setTabListed(boolean); void setTabName(String);
          boolean isNameTagVisible(); void setNameTagVisible(boolean); boolean isSneaking(); void setSneaking(boolean);
          void lookAt(double x, double y, double z); void lookAt(Vector target)
        EntityHolder class: es.edwardbelt.edlib.iapi.entity — ctors (Entity) or (EdEntity); Vector getPosition()

        EdModel interface: es.edwardbelt.edlib.iapi.model
        String getId(); Float getMaxHeight(); EdModelEntity createEntity(Location location)
        EdModelEntity interface: EdEntity getInteractionEntity()/getMainEntity()/getDisplayName();
        Map<String,EdEntity> getPassengers(); EdModel getModel(); void setYaw(float)/setPitch(float)/rotate(float,float);
        void spawn(); void setGlowing(EdColor); void addWatcher(Player); void remove();
        void playAnimation(String)/playLoopAnimation(String)/stopAnimation(); boolean isPlayingAnimation(); String getCurrentAnimation()

        Goal System (es.edwardbelt.edlib.iapi.entity.goal) — drive packet-entity movement
        EdGoal abstract class — void start()/init()/forceStop(); boolean isRunning()/shouldExecute(); void tick();
          void setEndRunnable(Runnable); void setStartRunnable(Runnable); void setEachTickRunnable(Runnable);
          EdEntity getEntity(); void setEntity(EdEntity); boolean isForceStopped()
        Goal impls (es.edwardbelt.edlib.iapi.entity.goal.impl):
        EdGoalMove(Vector moveGoal, double speed) — straight-line move; setAffectY/setSendRotationEachTick/setInvertRotation/setSendRotation
        EdGoalArchMove(Vector end, double speed, long duration)
        EdGoalParabolicMove(Vector end, double height, long duration)
        EdGoalOrbit(Vector center, double radius, double angularSpeed, boolean clockwise, int ticksDuration) — getCenterPoint/getRadius/isClockwise/getCurrentAngle/setAffectY/...
        EdGoalFollowEntity(EntityHolder target, double followDistance, double speed, long duration) // huge duration = "infinite"
        EdGoalDelay — getProgress/getRemainingTicks/getRemainingSeconds (use to pause a goal chain)
        You can also write your own goal: extend EdGoal, override shouldExecute()/tick(), and move with EdEntity#shortTp.

        SCHEDULING (es.edwardbelt.edlib.iapi.task) — EdLib's own scheduler, fine for packet work:
        TaskExecutor executor = EdLibAPI.getExecutor();
        EdTask async(Runnable task, String name)                         // run off the main thread now
        EdTask asyncLater(Runnable task, long delayTicks, String name)   // run off-thread after a delay
        EdTask repeatedAsync(Runnable task, double delayTicks, double periodTicks, String name) // async repeating
        EdTask sync(Runnable task, String name)                          // hop to the MAIN thread (for Bukkit world/entities)
        EdTask syncLater(Runnable task, long delayTicks, String name)
        EdTask: void cancel(); boolean isCancelled(); int getTaskId()
        Use async/asyncLater for packet effects and timers; use sync only when you must touch the real
        Bukkit world/entities/inventory. For timed entity sequences prefer goal runnables (setEndRunnable
        / setEachTickRunnable) or EdGoalDelay over manual timers. A common fail-safe: schedule an
        asyncLater that despawnInMines the entity in case the player leaves mid-animation.

        Enums:
        EdColor (es.edwardbelt.edlib.iapi): BLACK, DARK_BLUE, DARK_GREEN, DARK_AQUA, DARK_RED, DARK_PURPLE,
          GOLD, GRAY, DARK_GRAY, BLUE, GREEN, AQUA, RED, LIGHT_PURPLE, YELLOW, WHITE, ORANGE, MAGENTA,
          LIGHT_BLUE, LIME, PINK, LIGHT_GRAY, CYAN, PURPLE, BROWN  (String getName())
        EntityAnimation (es.edwardbelt.edlib.iapi.entity): SWING_MAIN_HAND(0), SWING_OFF_HAND(3), LEAVE_BED(1), CRITICAL_EFFECT(4), MAGIC_CRITICAL_EFFECT(5)
        EntityEquipmentSlot (es.edwardbelt.edlib.iapi.entity): MAIN_HAND(0), OFF_HAND(1), BOOTS(2), LEGGINGS(3), CHESTPLATE(4), HELMET(5), BODY(6), SADDLE(7)

        ============================================================================
        BEST PRACTICES (read before writing an enchant)
        ============================================================================
        - Prefer asyncSafe() = true for mine enchants and keep onProc packet/data only (MineService
          breaks, EdLib entities, currency changes, per-player particles/sounds). Return false only if
          you must touch the real Bukkit world/entities/inventories.
        - Break + reward ONLY through MineService (breakBlocks/breakLayer/breakSphere/breakBlock). Never
          touch the real world — mines have no real blocks. Default affectBlockCurrencies to false,
          affectAutosell + affectTokenGreed to true unless told otherwise.
        - Show packet entities with mines.spawnInMine(player, entity) (NOT addWatcher+spawn) and remove
          them with mines.despawnInMine(player, entity) (NOT entity.remove()). They auto-despawn when a
          player leaves the mine.
        - Particles/sounds are PER PLAYER: send them only to the digger (or to mines.getMineViewers(player)
          to show the whole mine), and ALWAYS gate them on enchants.isParticlesDisabled / isSoundsDisabled,
          and chat on isMessagesDisabled / isProcMessageDisabled. The more (gated) particle FX, the better.
        - Move packet entities through goals (EdGoalMove/Orbit/Parabolic/Arch/Follow) or a custom EdGoal
          using EdEntity#shortTp. Time sequences with the goal's setEachTickRunnable/setEndRunnable.
        - Center block positions with +0.5 when spawning entities or playing FX (block coords -> block center).
        - Scale the effect with the enchant level via enchants.getLevel(uuid, id).
        - NEVER hardcode tunables. Put a reward amount, radius, speed, currency id, durations, etc. in
          the enchant's settings: block and read them with enchants.getSettings(id). Read inside onProc
          (or refresh on reload) so /pinna reload picks up changes.
        - ALWAYS give the enchant a configurable proc-message in its yaml and send it with
          enchants.sendProcMessage(player, id, "{token}", value, ...) — it already respects the
          player's mute toggles, colours and PlaceholderAPI. Don't build chat by hand.

        ============================================================================
        HOW TO ADD THE ENCHANT (tell the user this AFTER you write the Java)
        ============================================================================
        An API enchant needs TWO files created on the server (besides your compiled plugin jar).
        Tell the user to create both, then run /pinna reload (or restart):

        1) The enchant config — plugins/PinnaPrison/enchants/<id>.yml  (the <id> MUST match your
           registerEnchant id). This makes the enchant exist, buyable and proc a chance:
        \`\`\`yaml
        color:
          primary: '&4'      # used by {prim-color} in name/lore
          secondary: '&c'    # used by {sec-color}
        starting-level: 0
        max-chance: 5        # max proc chance % (reached at max level)
        max-level: 1000
        material: NETHERITE_PICKAXE   # icon material (a Bukkit Material)
        type: 'api'          # ALWAYS 'api' for a registered APIEnchant
        display-name: 'Explosion'
        # ALWAYS include a proc-message so it is configurable. Send it from onProc with
        # enchants.sendProcMessage(player, "<id>", "{placeholder}", value, ...). Players can mute it
        # globally (/settings) or per-enchant (upgrade menu) and sendProcMessage respects that.
        # Supports colour codes, PlaceholderAPI and %pinnaprison_notation_<number>%.
        proc-message: '&c&lBOOM! &7Explosion blasted &a{blocks} &7blocks!'
        requirement:         # optional: gate buying it behind a leveling/currency
          economy: 'pickaxelevel'
          amount: 10
        # The settings: block holds YOUR enchant's custom config. Read it in onProc with
        # enchants.getSettings("<id>").getString/getDouble/getInt/getBoolean. Put anything here:
        # a reward currency + amount, an animation radius/speed, affect-* flags, etc.
        settings:
          radius: 3
          affect-autosell: true
          affect-tokengreed: true
          affect-block-currencies: false
        cost:
          currency: tokens
          starting-cost: 100
          increase-cost-by: 500
        prestige:            # optional: remove this whole block for no prestige
          enabled: true
          max-prestige: 5
          max-chance-per-prestige: 1   # +1% max chance per prestige
          reset-level: true
          requirements:
            tokens:
              type: currency
              amount: 500000
              remove: true
              scale-with-prestige: true
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
        GUI item placeholders filled by the 'enchant' custom item: {material}, {level}, {max-level},
        {cost}, {chance}, {status}. Anywhere you can also use PlaceholderAPI:
        %pinnaprison_enchant_level_<id>%, %pinnaprison_enchant_chance_<id>%,
        %pinnaprison_enchant_prestige_stars_<id>%, %pinnaprison_notation_<number>%.

        Final message to the user (after creating an enchant):
        "I created the <Name> enchant. To install it:
         1. Drop your compiled plugin jar in plugins/ (it depends on PinnaPrison).
         2. Create plugins/PinnaPrison/enchants/<id>.yml with the config above.
         3. Add the GUI item above to plugins/PinnaPrison/guis/token-enchants.yml (or gem-enchants.yml).
         4. Run /pinna reload (or restart). Buy it from the enchants menu and start mining!"
    `
};
