module.exports = {
    name: 'WorldGuard',
    description: 'WorldGuard protects regions of the world and gates behaviour behind flags. Its API lets a plugin ask "is this player allowed to build/PvP/use here?", read and edit regions and their owners/members, create regions programmatically, and register brand-new custom flags that server admins can then set with /region flag — the standard way to make your own plugin region-aware.',
    pluginId: 'WorldGuard',
    dependencies: `
        WorldEdit (WorldGuard depends on it, and its API uses WorldEdit types:
        BlockVector3, com.sk89q.worldedit.util.Location, com.sk89q.worldedit.world.World)
    `,
    mavenIntegration: `
        <repositories>
            <repository>
                <id>enginehub</id>
                <url>https://maven.enginehub.org/repo/</url>
            </repository>
        </repositories>
        <dependencies>
            <dependency>
                <groupId>com.sk89q.worldguard</groupId>
                <artifactId>worldguard-bukkit</artifactId>
                <version>7.0.9</version>
                <scope>provided</scope>
            </dependency>
            <!-- WorldEdit comes along transitively; declare it too if you use its types directly -->
            <dependency>
                <groupId>com.sk89q.worldedit</groupId>
                <artifactId>worldedit-bukkit</artifactId>
                <version>7.3.0</version>
                <scope>provided</scope>
            </dependency>
        </dependencies>
    `,
    usage: `
        /**
         * WorldGuard — com.sk89q.worldguard
         *
         * Two things to internalise before writing any code:
         *
         * 1. WorldGuard's API speaks WORLDEDIT types, not Bukkit types. A Bukkit Location must be
         *    adapted with BukkitAdapter before you can query with it, and a Bukkit Player must be
         *    wrapped into a LocalPlayer.
         *
         * 2. Custom flags MUST be registered in onLoad(), NOT onEnable(). WorldGuard freezes its
         *    flag registry once it finishes loading region data; registering later throws.
         */

        plugin.yml:
        \`\`\`
        name: MyPlugin
        version: 1.0
        main: com.example.MyPlugin
        api-version: '1.20'
        depend: [WorldGuard, WorldEdit]     # or softdepend + isPluginEnabled guards
        \`\`\`

        ============================================================================
        ADAPTING BUKKIT TYPES (you will need this in every snippet)
        ============================================================================
        \`\`\`java
        import com.sk89q.worldedit.bukkit.BukkitAdapter;
        import com.sk89q.worldguard.bukkit.WorldGuardPlugin;
        import com.sk89q.worldguard.LocalPlayer;

        com.sk89q.worldedit.util.Location weLoc = BukkitAdapter.adapt(bukkitLocation);
        com.sk89q.worldedit.world.World weWorld = BukkitAdapter.adapt(bukkitWorld);
        com.sk89q.worldedit.math.BlockVector3 vec = BukkitAdapter.asBlockVector(bukkitLocation);

        LocalPlayer localPlayer = WorldGuardPlugin.inst().wrapPlayer(bukkitPlayer);
        // wrapPlayer(player, true) gives an "offline" wrapper that skips permission lookups.
        \`\`\`

        ============================================================================
        ENTRY POINT
        ============================================================================
        \`\`\`java
        import com.sk89q.worldguard.WorldGuard;
        import com.sk89q.worldguard.protection.regions.RegionContainer;
        import com.sk89q.worldguard.protection.regions.RegionQuery;

        RegionContainer container = WorldGuard.getInstance().getPlatform().getRegionContainer();
        RegionQuery query = container.createQuery();
        \`\`\`

        WorldGuard (com.sk89q.worldguard):
        static WorldGuard getInstance()
        WorldGuardPlatform getPlatform()                  // -> getRegionContainer(), getSessionManager(), …
        FlagRegistry getFlagRegistry()                    // register custom flags here (in onLoad!)
        ProfileService getProfileService(); ProfileCache getProfileCache()
        ListeningExecutorService getExecutorService()
        static String getVersion()

        RegionContainer (protection.regions):
        RegionManager get(com.sk89q.worldedit.world.World world)   // null if regions aren't loaded for it
        RegionQuery createQuery()
        List<RegionManager> getLoaded()
        RegionDriver getDriver(); void reload(); void unload(World world)

        ============================================================================
        ASKING "IS THIS ALLOWED HERE?" — RegionQuery
        ============================================================================
        This is the API you want 90% of the time. It resolves region priorities, inheritance,
        global region defaults and membership for you.

        RegionQuery (protection.regions):
        ApplicableRegionSet getApplicableRegions(Location loc)
        ApplicableRegionSet getApplicableRegions(Location loc, QueryOption option)
        boolean testBuild(Location loc, LocalPlayer player, StateFlag... flags)   // build + the extra flags
        boolean testBuild(Location loc, RegionAssociable subject, StateFlag... flags)
        boolean testState(Location loc, LocalPlayer player, StateFlag... flags)   // just the flags
        boolean testState(Location loc, RegionAssociable subject, StateFlag... flags)
        StateFlag.State queryState(Location loc, LocalPlayer player, StateFlag... flags) // ALLOW/DENY/null
        <V> V queryValue(Location loc, LocalPlayer player, Flag<V> flag)          // typed value, null if unset
        <V> Collection<V> queryAllValues(Location loc, LocalPlayer player, Flag<V> flag)
        <V, K> V queryMapValue(Location loc, RegionAssociable subject, MapFlag<K,V> flag, K key)

        Pass \`null\` as the player/subject to ask "what does the region say, ignoring membership".

        {IMPORTANT} testState vs testBuild: testState only consults the flags you name. testBuild
        also applies the implicit build permission (membership/ownership + the BUILD flag). For
        "can this player place a block here", use testBuild or testState(..., Flags.BLOCK_PLACE).

        ApplicableRegionSet (protection) — the regions at a point, highest priority first:
        int size(); Set<ProtectedRegion> getRegions(); (it is Iterable<ProtectedRegion>)
        boolean testState(RegionAssociable subject, StateFlag... flags)
        StateFlag.State queryState(RegionAssociable subject, StateFlag... flags)
        <V> V queryValue(RegionAssociable subject, Flag<V> flag)
        <V> Collection<V> queryAllValues(RegionAssociable subject, Flag<V> flag)
        boolean isOwnerOfAll(LocalPlayer player); boolean isMemberOfAll(LocalPlayer player)
        boolean isVirtual()                                   // true when regions aren't loaded — treat as "no data"

        ============================================================================
        REGIONS — RegionManager and ProtectedRegion
        ============================================================================
        RegionManager (protection.managers) — one per world:
        Map<String, ProtectedRegion> getRegions()
        ProtectedRegion getRegion(String id); boolean hasRegion(String id)
        void addRegion(ProtectedRegion region)
        Set<ProtectedRegion> removeRegion(String id)
        Set<ProtectedRegion> removeRegion(String id, RemovalStrategy strategy) // REMOVE_CHILDREN | UNSET_PARENT_IN_CHILDREN
        ApplicableRegionSet getApplicableRegions(BlockVector3 position)
        List<String> getApplicableRegionsIDs(BlockVector3 position)
        int getRegionCountOfPlayer(LocalPlayer player)
        void save() throws StorageException; boolean saveChanges() throws StorageException

        ProtectedRegion (protection.regions) — abstract; concrete types:
          ProtectedCuboidRegion(String id, BlockVector3 min, BlockVector3 max)
          ProtectedPolygonalRegion(String id, List<BlockVector2> points, int minY, int maxY)
          GlobalProtectedRegion(String id)
        String getId(); RegionType getType(); int volume()
        BlockVector3 getMinimumPoint(); BlockVector3 getMaximumPoint()
        int getPriority(); void setPriority(int priority)       // higher wins
        DefaultDomain getOwners(); DefaultDomain getMembers()   // .addPlayer(UUID/name), .removePlayer(...), .contains(...)
        ProtectedRegion getParent(); void setParent(ProtectedRegion) throws CircularInheritanceException
        <T extends Flag<V>, V> V getFlag(T flag)                // the RAW value set on THIS region only
        <T extends Flag<V>, V> void setFlag(T flag, V value)    // null clears it
        Map<Flag<?>, Object> getFlags(); void setFlags(Map<Flag<?>, Object>)
        boolean contains(BlockVector3 pt); boolean contains(int x, int y, int z)

        {IMPORTANT} getFlag() on a region is NOT the same as querying. It reads only that one
        region's own value, ignoring priority, inheritance and the global region. For decisions,
        always go through RegionQuery / ApplicableRegionSet.

        ============================================================================
        FLAGS
        ============================================================================
        com.sk89q.worldguard.protection.flags.Flags holds every built-in flag as a static field.
        StateFlag ones evaluate to StateFlag.State.ALLOW / DENY / null (unset):

        BUILD, BLOCK_BREAK, BLOCK_PLACE, USE, INTERACT, CHEST_ACCESS, PVP, SLEEP, TNT, LIGHTER,
        RIDE, DAMAGE_ANIMALS, MOB_DAMAGE, MOB_SPAWNING, DENY_SPAWN, CREEPER_EXPLOSION,
        OTHER_EXPLOSION, GHAST_FIREBALL, WITHER_DAMAGE, ENDER_BUILD, PISTONS, ITEM_PICKUP,
        ITEM_DROP, EXP_DROPS, PLACE_VEHICLE, DESTROY_VEHICLE, POTION_SPLASH, ITEM_FRAME_ROTATE,
        TRAMPLE_BLOCKS, FIREWORK_DAMAGE, USE_ANVIL, INVINCIBILITY, FALL_DAMAGE, HEALTH_REGEN,
        HUNGER_DRAIN, ENTRY, EXIT, EXIT_OVERRIDE, EXIT_VIA_TELEPORT, ENDERPEARL, CHORUS_TELEPORT,
        SEND_CHAT, RECEIVE_CHAT, NOTIFY_ENTER, NOTIFY_LEAVE, PASSTHROUGH,
        FIRE_SPREAD, LAVA_FIRE, LIGHTNING, SNOW_FALL, SNOW_MELT, ICE_FORM, ICE_MELT, MUSHROOMS,
        LEAF_DECAY, GRASS_SPREAD, MYCELIUM_SPREAD, VINE_GROWTH, CROP_GROWTH, SCULK_GROWTH,
        SOIL_DRY, CORAL_FADE, WATER_FLOW, LAVA_FLOW, MOISTURE_CHANGE, WEATHER_LOCK, TIME_LOCK

        Typed (non-State) flags — use queryValue:
        GREET_MESSAGE, FAREWELL_MESSAGE, GREET_TITLE, FAREWELL_TITLE, DENY_MESSAGE,
        ENTRY_DENY_MESSAGE, EXIT_DENY_MESSAGE, TELE_LOC, SPAWN_LOC, TELE_MESSAGE, GAME_MODE,
        HEAL_DELAY, HEAL_AMOUNT, MIN_HEAL, MAX_HEAL, FEED_DELAY, FEED_AMOUNT, MIN_FOOD, MAX_FOOD,
        BLOCKED_CMDS, ALLOWED_CMDS

        Flag classes you can instantiate for your own: StateFlag, BooleanFlag, IntegerFlag,
        DoubleFlag, StringFlag, SetFlag<T>, EnumFlag<E>, LocationFlag, VectorFlag, MapFlag<K,V>,
        RegistryFlag, CommandStringFlag.

        ============================================================================
        REGISTERING A CUSTOM FLAG (must be in onLoad)
        ============================================================================
        \`\`\`java
        import com.sk89q.worldguard.WorldGuard;
        import com.sk89q.worldguard.protection.flags.StateFlag;
        import com.sk89q.worldguard.protection.flags.registry.FlagConflictException;
        import com.sk89q.worldguard.protection.flags.registry.FlagRegistry;

        public class MyPlugin extends JavaPlugin {

            public static StateFlag MY_FLAG;   // admins then use: /rg flag <region> my-flag allow

            @Override
            public void onLoad() {                       // onLoad, NOT onEnable
                FlagRegistry registry = WorldGuard.getInstance().getFlagRegistry();
                try {
                    StateFlag flag = new StateFlag("my-flag", true);  // true = default ALLOW
                    registry.register(flag);
                    MY_FLAG = flag;
                } catch (FlagConflictException e) {
                    // Someone already registered that name — reuse it if the type matches.
                    var existing = registry.get("my-flag");
                    if (existing instanceof StateFlag stateFlag) MY_FLAG = stateFlag;
                    else getLogger().severe("Flag name 'my-flag' is taken by an incompatible flag");
                }
            }
        }
        \`\`\`
        Then query it exactly like a built-in:
        \`\`\`java
        LocalPlayer lp = WorldGuardPlugin.inst().wrapPlayer(player);
        boolean allowed = query.testState(BukkitAdapter.adapt(player.getLocation()), lp, MyPlugin.MY_FLAG);
        \`\`\`

        ============================================================================
        EXAMPLES
        ============================================================================
        --- Can this player build here? ---
        \`\`\`java
        RegionContainer container = WorldGuard.getInstance().getPlatform().getRegionContainer();
        RegionQuery query = container.createQuery();
        LocalPlayer lp = WorldGuardPlugin.inst().wrapPlayer(player);

        if (!query.testBuild(BukkitAdapter.adapt(player.getLocation()), lp)) {
            player.sendMessage("You can't build here.");
            return;
        }
        \`\`\`

        --- Is PvP on at this location (regardless of who is asking)? ---
        \`\`\`java
        boolean pvp = query.testState(BukkitAdapter.adapt(loc), (RegionAssociable) null, Flags.PVP);
        \`\`\`

        --- Read a typed flag value ---
        \`\`\`java
        String greeting = query.queryValue(BukkitAdapter.adapt(loc), lp, Flags.GREET_MESSAGE);
        \`\`\`

        --- Which regions is the player standing in? ---
        \`\`\`java
        ApplicableRegionSet set = query.getApplicableRegions(BukkitAdapter.adapt(player.getLocation()));
        for (ProtectedRegion region : set) {
            player.sendMessage(region.getId() + " (priority " + region.getPriority() + ")");
        }
        boolean inSpawn = set.getRegions().stream().anyMatch(r -> r.getId().equalsIgnoreCase("spawn"));
        \`\`\`

        --- Create a region in code ---
        \`\`\`java
        RegionManager regions = container.get(BukkitAdapter.adapt(world));
        if (regions == null) return;                     // regions not loaded for that world

        BlockVector3 min = BlockVector3.at(100, 0, 100);
        BlockVector3 max = BlockVector3.at(150, 255, 150);
        ProtectedCuboidRegion region = new ProtectedCuboidRegion("plot_" + player.getName(), min, max);
        region.setPriority(10);
        region.getOwners().addPlayer(player.getUniqueId());
        region.setFlag(Flags.PVP, StateFlag.State.DENY);
        region.setFlag(Flags.GREET_MESSAGE, "Welcome to " + player.getName() + "'s plot!");
        regions.addRegion(region);
        try { regions.saveChanges(); } catch (StorageException e) { e.printStackTrace(); }
        \`\`\`

        --- Owners and members ---
        \`\`\`java
        ProtectedRegion region = regions.getRegion("spawn");
        if (region != null) {
            region.getMembers().addPlayer(player.getUniqueId());
            region.getOwners().removePlayer(player.getUniqueId());
            boolean isOwner = region.getOwners().contains(player.getUniqueId());
        }
        \`\`\`

        --- Session handlers: react to entering/leaving regions ---
        \`\`\`java
        // WorldGuard's own way to hook movement is a session Handler:
        WorldGuard.getInstance().getPlatform().getSessionManager()
                .registerHandler(MyHandler.FACTORY, null);
        // Your Handler extends com.sk89q.worldguard.session.handler.Handler and overrides
        // onCrossBoundary(LocalPlayer, Location from, Location to, ApplicableRegionSet toSet,
        //                 Set<ProtectedRegion> entered, Set<ProtectedRegion> exited, MoveType moveType)
        // returning false to block the move. Register it in onEnable.
        \`\`\`
        For most plugins a plain Bukkit PlayerMoveEvent listener that diffs
        \`getApplicableRegions(from)\` vs \`getApplicableRegions(to)\` is simpler and good enough.

        ============================================================================
        PRACTICAL NOTES
        ============================================================================
        - Register custom flags in onLoad(). In onEnable it is too late and throws IllegalStateException.
        - container.get(world) can return null (regions not loaded for that world). Always null-check.
        - Region queries are cached and cheap, but not free. Do not call them once per block in a
          loop over a large area — query the corners, or query once per player-move.
        - StateFlag.State has three values: ALLOW, DENY and null (unset). Treat null as "no opinion"
          and fall back to your own default; never assume null means deny.
        - saveChanges() persists; addRegion alone only changes memory until WorldGuard next saves.
        - If WorldGuard is a softdepend, guard every entry point with
          Bukkit.getPluginManager().isPluginEnabled("WorldGuard") and keep the WorldGuard imports
          inside a separate class so your plugin still loads when it is absent.
        - WorldGuardExtraFlags is a separate community plugin adding more flags (fly, walk-speed,
          give-effects, chat-prefix, …). Its flags are registered under its own class and are only
          available when that plugin is installed.
    `
};
