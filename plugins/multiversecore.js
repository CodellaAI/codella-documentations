module.exports = {
    name: 'Multiverse-Core',
    description: 'Multiverse-Core manages multiple worlds on a Bukkit server: creating, cloning, loading, unloading and deleting them at runtime, plus per-world settings (gamemode, PvP, difficulty, spawn, scaling, entry fee, respawn target). Its API is how a plugin creates worlds on demand — dungeon instances, per-player islands, minigame arenas — instead of shelling out to /mv commands.',
    pluginId: 'Multiverse-Core',
    mavenIntegration: `
        <repositories>
            <repository>
                <id>onarandombox</id>
                <url>https://repo.onarandombox.com/content/groups/public/</url>
            </repository>
        </repositories>
        <dependencies>
            <dependency>
                <groupId>com.onarandombox.multiversecore</groupId>
                <artifactId>Multiverse-Core</artifactId>
                <version>4.3.12</version>
                <scope>provided</scope>
            </dependency>
        </dependencies>
    `,
    usage: `
        /**
         * Multiverse-Core 4.x — com.onarandombox.MultiverseCore
         *
         * NOTE ON VERSIONS: this documents the 4.x API (package com.onarandombox.MultiverseCore),
         * which is what the overwhelming majority of servers still run. Multiverse 5.x moved to
         * org.mvplugins.multiverse.core with a completely different, DI-based API — if the server
         * runs 5.x, none of the classes below exist.
         *
         * Everything goes through MVWorldManager. A "MultiverseWorld" wraps a Bukkit World plus
         * Multiverse's own per-world settings.
         */

        plugin.yml:
        \`\`\`
        name: MyPlugin
        version: 1.0
        main: com.example.MyPlugin
        api-version: '1.20'
        depend: [Multiverse-Core]
        \`\`\`

        ============================================================================
        ENTRY POINT
        ============================================================================
        \`\`\`java
        import com.onarandombox.MultiverseCore.MultiverseCore;
        import com.onarandombox.MultiverseCore.api.MVWorldManager;
        import com.onarandombox.MultiverseCore.api.MultiverseWorld;
        import org.bukkit.Bukkit;

        MultiverseCore core = (MultiverseCore) Bukkit.getPluginManager().getPlugin("Multiverse-Core");
        if (core == null) return;
        MVWorldManager worlds = core.getMVWorldManager();
        \`\`\`

        ============================================================================
        MVWorldManager
        ============================================================================
        boolean addWorld(String name, World.Environment env, String seedString, WorldType type,
                         Boolean generateStructures, String generator)
        boolean addWorld(String name, World.Environment env, String seedString, WorldType type,
                         Boolean generateStructures, String generator, boolean useSpawnAdjust)
        boolean cloneWorld(String oldName, String newName)
        boolean cloneWorld(String oldName, String newName, String generator)
        boolean loadWorld(String name)
        boolean unloadWorld(String name); boolean unloadWorld(String name, boolean unloadBukkit)
        boolean deleteWorld(String name)                        // DELETES THE FOLDER — irreversible
        boolean deleteWorld(String name, boolean removeConfig)
        boolean deleteWorld(String name, boolean removeFromConfig, boolean deleteWorldFolder)
        void removePlayersFromWorld(String name)                // send everyone to the default world
        Collection<MultiverseWorld> getMVWorlds()
        MultiverseWorld getMVWorld(String name)                 // name OR alias
        MultiverseWorld getMVWorld(World world)
        boolean isMVWorld(String name); boolean isMVWorld(World world)
        ChunkGenerator getChunkGenerator(String generator, String generatorId, String worldName)
        void loadWorlds(boolean forceLoad); void loadDefaultWorlds()
        WorldPurger getTheWorldPurger()

        ============================================================================
        MultiverseWorld — per-world settings
        ============================================================================
        World getCBWorld()                                      // the Bukkit World (null if unloaded)
        String getName(); String getAlias(); void setAlias(String alias)
        World.Environment getEnvironment()
        long getSeed(); void setSeed(long seed)
        Location getSpawnLocation(); void setSpawnLocation(Location loc)
        boolean isPVPEnabled(); void setPVPMode(boolean pvp)
        GameMode getGameMode(); boolean setGameMode(GameMode mode); boolean setGameMode(String mode)
        Difficulty getDifficulty(); boolean setDifficulty(Difficulty d); boolean setDifficulty(String d)
        double getScaling(); boolean setScaling(double scaling)  // portal coordinate scaling
        double getPrice(); void setPrice(double price)           // entry fee
        World getRespawnToWorld(); boolean setRespawnToWorld(String world)
        void setEnableWeather(boolean enabled)
        void setKeepSpawnInMemory(boolean keep)
        void setHunger(boolean hungerEnabled)
        void setAutoHeal(boolean autoHeal)
        List<String> getWorldBlacklist()

        ============================================================================
        EXAMPLES
        ============================================================================
        --- Create a world at runtime ---
        \`\`\`java
        import org.bukkit.World;
        import org.bukkit.WorldType;

        boolean created = worlds.addWorld(
                "dungeon_" + player.getName(),   // world name (also the folder name)
                World.Environment.NORMAL,
                null,                            // seed; null = random
                WorldType.FLAT,
                false,                           // generate structures
                null);                           // custom generator plugin, null = vanilla

        if (created) {
            MultiverseWorld mv = worlds.getMVWorld("dungeon_" + player.getName());
            mv.setPVPMode(false);
            mv.setGameMode(GameMode.ADVENTURE);
            mv.setDifficulty(Difficulty.NORMAL);
            mv.setKeepSpawnInMemory(false);      // saves memory for throwaway worlds
            mv.setAlias("&6Dungeon");
            player.teleport(mv.getCBWorld().getSpawnLocation());
        }
        \`\`\`

        --- Clone a template world (the usual instancing pattern) ---
        \`\`\`java
        String instance = "arena_" + System.currentTimeMillis();
        if (worlds.cloneWorld("arena_template", instance)) {
            MultiverseWorld mv = worlds.getMVWorld(instance);
            mv.setPVPMode(true);
            // ... run the game ...
        }
        \`\`\`
        Cloning copies the world folder on the main thread. For a big template that is a visible
        freeze — clone a small template, or pre-create a pool of instances at startup.

        --- Tear an instance down ---
        \`\`\`java
        worlds.removePlayersFromWorld(instance);   // get everyone out first
        worlds.unloadWorld(instance);
        worlds.deleteWorld(instance, true, true);  // remove from config AND delete the folder
        \`\`\`

        --- Read settings ---
        \`\`\`java
        MultiverseWorld mv = worlds.getMVWorld(player.getWorld());
        if (mv != null && !mv.isPVPEnabled()) player.sendMessage("PvP is off in " + mv.getAlias());
        \`\`\`

        ============================================================================
        SAFE TELEPORTS AND DESTINATIONS
        ============================================================================
        \`\`\`java
        import com.onarandombox.MultiverseCore.api.SafeTTeleporter;
        import com.onarandombox.MultiverseCore.api.MVDestination;
        import com.onarandombox.MultiverseCore.destination.DestinationFactory;

        SafeTTeleporter teleporter = core.getSafeTTeleporter();
        Location safe = teleporter.getSafeLocation(rawLocation);   // nudges out of blocks/lava

        DestinationFactory factory = core.getDestFactory();
        MVDestination dest = factory.getDestination("w:world_nether");  // same syntax as /mvtp
        teleporter.safelyTeleport(sender, player, dest);
        \`\`\`

        ============================================================================
        PRACTICAL NOTES
        ============================================================================
        - deleteWorld() deletes the world FOLDER from disk. There is no undo. Guard it, and never
          call it on a name you did not create yourself.
        - addWorld / cloneWorld / deleteWorld all do heavy disk I/O ON THE MAIN THREAD. Creating a
          world mid-game will lag the server for a noticeable moment; create instances ahead of time
          where you can.
        - getMVWorld(name) matches the ALIAS as well as the real name, which is convenient but means
          two worlds can collide if an alias equals another world's name.
        - getCBWorld() returns null for a world that Multiverse knows about but is currently
          unloaded. Always null-check before touching Bukkit APIs on it.
        - Worlds created by Multiverse persist in its worlds.yml and come back on restart. For
          throwaway instances, delete them properly on shutdown or you will accumulate hundreds of
          folders.
        - If you only need to create ONE world and do not care about per-world settings, plain
          Bukkit \`new WorldCreator(name).createWorld()\` needs no dependency at all. Reach for
          Multiverse when you want its settings, aliases, portals and per-world rules.
        - Multiverse 5.x (org.mvplugins.multiverse.core) is a different API. Detect the version if
          you must support both, and keep the 4.x calls in an isolated class so the missing classes
          do not break your plugin's classloading.
    `
};
