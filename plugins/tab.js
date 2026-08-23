module.exports = {
    name: 'TAB',
    description: 'TAB by NEZNAMY controls the tablist, nametags above heads, scoreboards, boss bars, header/footer and player sorting on Bukkit, BungeeCord and Velocity. Its API lets a plugin override any of those per player, register its own placeholders that TAB refreshes on a timer, and react to TAB load events — the standard way to drive rank prefixes, per-player scoreboards and dynamic tablists from code.',
    pluginId: 'TAB',
    mavenIntegration: `
        <repositories>
            <repository>
                <id>krypton</id>
                <url>https://repo.kryptonmc.org/releases</url>
            </repository>
        </repositories>
        <dependencies>
            <dependency>
                <groupId>me.neznamy</groupId>
                <artifactId>tab-api</artifactId>
                <version>5.0.4</version>
                <scope>provided</scope>
            </dependency>
        </dependencies>
    `,
    usage: `
        /**
         * TAB — me.neznamy.tab.api
         *
         * Everything hangs off TabAPI.getInstance() and is split into managers. A manager returns
         * null when that FEATURE IS DISABLED in TAB's config — always null-check the manager, not
         * just the player.
         *
         * TAB has its own player wrapper (TabPlayer) because it also runs on proxies where there is
         * no Bukkit Player. Convert with getPlayer(uuid).
         */

        plugin.yml:
        \`\`\`
        name: MyPlugin
        version: 1.0
        main: com.example.MyPlugin
        api-version: '1.20'
        softdepend: [TAB]
        \`\`\`

        ============================================================================
        ENTRY POINT
        ============================================================================
        \`\`\`java
        import me.neznamy.tab.api.TabAPI;
        import me.neznamy.tab.api.TabPlayer;

        TabAPI tab = TabAPI.getInstance();
        TabPlayer tp = tab.getPlayer(player.getUniqueId());   // null if TAB hasn't loaded them yet
        \`\`\`

        TabAPI (static getInstance()):
        TabPlayer getPlayer(UUID uuid); TabPlayer getPlayer(String name)
        TabPlayer[] getOnlinePlayers()
        NameTagManager getNameTagManager()             // nametags above heads (+ team collision/sorting)
        ScoreboardManager getScoreboardManager()       // sidebar scoreboards
        BossBarManager getBossBarManager()
        HeaderFooterManager getHeaderFooterManager()   // tablist header/footer
        TabListFormatManager getTabListFormatManager() // tablist prefix/name/suffix
        PlaceholderManager getPlaceholderManager()     // register your own %placeholders%
        LayoutManager getLayoutManager()               // fixed-slot tablist layouts
        SortingManager getSortingManager()
        EventBus getEventBus()

        TabPlayer:
        String getName(); UUID getUniqueId()
        Object getPlayer()                             // the platform object — cast to org.bukkit.entity.Player
        boolean isLoaded()                             // false until TAB finished loading them
        String getGroup()                              // the permission group TAB resolved
        void setTemporaryGroup(String group); boolean hasTemporaryGroup()
        String getServer(); String getWorld()
        boolean isBedrockPlayer()
        void setExpectedProfileName(String); String getExpectedProfileName()

        ============================================================================
        NAMETAGS — NameTagManager
        ============================================================================
        void setPrefix(TabPlayer player, String prefix)     // null clears your override
        void setSuffix(TabPlayer player, String suffix)
        String getCustomPrefix(TabPlayer); String getCustomSuffix(TabPlayer)
        String getOriginalPrefix(TabPlayer); String getOriginalSuffix(TabPlayer)
        String getOriginalRawPrefix(TabPlayer); String getOriginalReplacedPrefix(TabPlayer)
        void hideNameTag(TabPlayer player)                          // from everyone
        void hideNameTag(TabPlayer player, TabPlayer viewer)        // from one viewer
        void showNameTag(TabPlayer player); void showNameTag(TabPlayer, TabPlayer viewer)
        boolean hasHiddenNameTag(TabPlayer); boolean hasHiddenNameTag(TabPlayer, TabPlayer viewer)
        void pauseTeamHandling(TabPlayer player)                    // let another plugin own the team
        void resumeTeamHandling(TabPlayer player); boolean hasTeamHandlingPaused(TabPlayer)
        void setCollisionRule(TabPlayer player, Boolean collision); Boolean getCollisionRule(TabPlayer)

        \`\`\`java
        NameTagManager nametags = tab.getNameTagManager();
        if (nametags != null) {
            nametags.setPrefix(tp, "&c[ADMIN] ");
            nametags.setSuffix(tp, " &7[100]");
            nametags.hideNameTag(tp);                 // e.g. while vanished
        }
        \`\`\`

        {IMPORTANT} If another plugin also writes scoreboard TEAMS (nametag colours, collision),
        the two will fight. Call pauseTeamHandling(player) while your plugin owns the team, and
        resumeTeamHandling(player) when you are done.

        ============================================================================
        TABLIST FORMAT — TabListFormatManager
        ============================================================================
        void setPrefix(TabPlayer, String); void setName(TabPlayer, String); void setSuffix(TabPlayer, String)
        String getCustomPrefix/getCustomName/getCustomSuffix(TabPlayer)
        String getOriginalPrefix/getOriginalName/getOriginalSuffix(TabPlayer)
        \`\`\`java
        TabListFormatManager list = tab.getTabListFormatManager();
        if (list != null) list.setPrefix(tp, "&6[VIP] ");
        \`\`\`
        Pass null to any setter to drop your override and fall back to TAB's config.

        ============================================================================
        HEADER / FOOTER
        ============================================================================
        void setHeader(TabPlayer, String header)
        void setFooter(TabPlayer, String footer)
        void setHeaderAndFooter(TabPlayer, String header, String footer)
        \`\`\`java
        tab.getHeaderFooterManager().setHeaderAndFooter(tp,
                "&6&lMY SERVER\\n&7Welcome, %player%",
                "&7Online: %online%");
        \`\`\`

        ============================================================================
        SCOREBOARDS — ScoreboardManager
        ============================================================================
        Scoreboard createScoreboard(String name, String title, List<String> lines)
        void showScoreboard(TabPlayer player, Scoreboard scoreboard)
        Scoreboard getActiveScoreboard(TabPlayer player)
        void resetScoreboard(TabPlayer player)                       // back to TAB's own
        boolean hasCustomScoreboard(TabPlayer)
        boolean hasScoreboardVisible(TabPlayer)
        void setScoreboardVisible(TabPlayer player, boolean visible, boolean sendToggleMessage)
        void toggleScoreboard(TabPlayer player, boolean sendToggleMessage)
        void announceScoreboard(String scoreboard, int durationSeconds)   // to everyone
        Map<String, Scoreboard> getRegisteredScoreboards()
        void removeScoreboard(String name); void removeScoreboard(Scoreboard)

        \`\`\`java
        ScoreboardManager sb = tab.getScoreboardManager();
        if (sb != null) {
            Scoreboard board = sb.createScoreboard("arena", "&6&lARENA",
                    List.of("&7Kills: &f%myplugin_kills%", "&7Time: &f%myplugin_time%", "", "&eplay.example.net"));
            sb.showScoreboard(tp, board);
            // later:
            sb.resetScoreboard(tp);
        }
        \`\`\`
        The lines may contain TAB placeholders (including your own registered ones and PlaceholderAPI),
        and TAB refreshes them automatically — you do NOT rebuild the scoreboard to update a value.

        ============================================================================
        BOSS BARS — BossBarManager
        ============================================================================
        BossBar createBossBar(String name, float progress, BarColor color, BarStyle style)
        BossBar createBossBar(String name, String title, String progress, String color)  // placeholder-driven
        BossBar getBossBar(String name); Map<String, BossBar> getRegisteredBossBars()
        void removeBossBar(String name); void removeBossBar(BossBar)
        void sendBossBarTemporarily(TabPlayer player, String bossBar, int durationSeconds)
        void announceBossBar(String bossBar, int durationSeconds)
        void toggleBossBar(TabPlayer player, boolean sendToggleMessage)
        boolean hasBossBarVisible(TabPlayer); void setBossBarVisible(TabPlayer, boolean, boolean)
        List<BossBar> getAnnouncedBossBars()
        BarColor: PINK, BLUE, RED, GREEN, YELLOW, PURPLE, WHITE
        BarStyle: PROGRESS, NOTCHED_6, NOTCHED_10, NOTCHED_12, NOTCHED_20

        ============================================================================
        YOUR OWN PLACEHOLDERS — PlaceholderManager
        ============================================================================
        This is the most useful part of the API: TAB refreshes these on its own timer, so your
        scoreboard/tablist values stay live with no work from you.

        ServerPlaceholder registerServerPlaceholder(String identifier, int refreshMillis, Supplier<String> supplier)
        PlayerPlaceholder registerPlayerPlaceholder(String identifier, int refreshMillis, Function<TabPlayer, String> function)
        RelationalPlaceholder registerRelationalPlaceholder(String identifier, int refreshMillis,
                                        BiFunction<TabPlayer, TabPlayer, String> function)   // viewer, target
        Also regex-pattern overloads of all three for parameterised placeholders.
        Placeholder getPlaceholder(String identifier)
        void unregisterPlaceholder(String identifier); void unregisterPlaceholder(Placeholder)

        \`\`\`java
        PlaceholderManager pm = tab.getPlaceholderManager();

        // Same value for everyone, refreshed every second:
        pm.registerServerPlaceholder("%myplugin_arena_time%", 1000,
                () -> formatTime(arena.getRemainingSeconds()));

        // Per player, refreshed every 500ms:
        pm.registerPlayerPlaceholder("%myplugin_kills%", 500,
                p -> String.valueOf(getKills(p.getUniqueId())));

        // Depends on WHO IS LOOKING at whom (e.g. show a red name to enemies):
        pm.registerRelationalPlaceholder("%rel_myplugin_team%", 1000,
                (viewer, target) -> sameTeam(viewer, target) ? "&a" : "&c");
        \`\`\`

        {IMPORTANT} The refresh function runs on TAB's own thread, on a timer, for every online
        player. It must be FAST and thread-safe — read a cached field, never hit a database or the
        Bukkit API directly inside it. Do not set refreshMillis below ~200 unless you truly need it;
        \`-1\` means "never refresh automatically".

        ============================================================================
        EVENTS — EventBus
        ============================================================================
        \`\`\`java
        import me.neznamy.tab.api.event.player.PlayerLoadEvent;
        import me.neznamy.tab.api.event.plugin.TabLoadEvent;

        tab.getEventBus().register(TabLoadEvent.class, event -> {
            // TAB (re)loaded — re-register your placeholders here, they are cleared on reload
            registerPlaceholders();
        });

        tab.getEventBus().register(PlayerLoadEvent.class, event -> {
            TabPlayer p = event.getPlayer();
            boolean joined = event.isJoin();       // false = a reload re-load
            applyMyFormat(p);
        });
        \`\`\`
        Available events: TabLoadEvent (plugin loaded/reloaded), PlayerLoadEvent (a player is ready).

        ============================================================================
        PRACTICAL NOTES
        ============================================================================
        - Every manager can be null. TAB returns null for a manager whose feature is turned off in
          config.yml, and calling into it blindly is the most common crash in TAB integrations.
        - TabAPI.getInstance().getPlayer(uuid) returns null until TAB has loaded that player. Do your
          per-player setup from PlayerLoadEvent, not from Bukkit's PlayerJoinEvent.
        - Re-register placeholders on TabLoadEvent. A \`/tab reload\` clears API-registered placeholders,
          and users reload TAB constantly.
        - Convert TabPlayer -> Bukkit Player with \`(Player) tabPlayer.getPlayer()\`. This cast is only
          valid on Bukkit; on a proxy the object is a Bungee/Velocity player.
        - Formatting accepts legacy \`&\` codes, \`&#RRGGBB\` hex, and TAB's own gradient syntax
          (\`<#FF0000>text</#00FF00>\`), plus any placeholder TAB knows.
        - Passing null to setPrefix/setSuffix/setName removes YOUR override and restores TAB's config
          value — that is how you cleanly undo an API change.
        - TAB overrides the vanilla scoreboard/team packets. If your plugin also uses Bukkit's
          Scoreboard API for sidebars or teams, expect a conflict — use TAB's managers instead, or
          pause TAB's handling for that player.
    `
};
