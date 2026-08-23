module.exports = {
    name: 'ajLeaderboards',
    description: 'ajLeaderboards turns any PlaceholderAPI placeholder into a cached leaderboard with all-time, hourly, daily, weekly, monthly and yearly variants. Its API lets a plugin read the entry at any position (or a specific player\'s position and score) on any board and timeframe, and react to the reset/update events — the easy way to show top-10 lists without maintaining your own ranking table.',
    pluginId: 'ajLeaderboards',
    dependencies: `
        PlaceholderAPI (the stats a board tracks are placeholders)
    `,
    mavenIntegration: `
        <repositories>
            <repository>
                <id>ajg0702</id>
                <url>https://repo.ajg0702.us/releases</url>
            </repository>
        </repositories>
        <dependencies>
            <dependency>
                <groupId>us.ajg0702</groupId>
                <artifactId>leaderboards</artifactId>
                <version>2.10.1</version>
                <scope>provided</scope>
            </dependency>
        </dependencies>
    `,
    usage: `
        /**
         * ajLeaderboards — us.ajg0702.leaderboards
         *
         * The model:
         *   A BOARD is a PlaceholderAPI placeholder the server admin added with
         *   /ajlb add <placeholder>. ajLeaderboards periodically samples it for every known player
         *   and caches the sorted result.
         *
         *   A TIMED TYPE is the timeframe: ALLTIME, HOURLY, DAILY, WEEKLY, MONTHLY, YEARLY. The
         *   timed ones track the DELTA since that period started.
         *
         *   A StatEntry is one row: a position, a player, a score, plus prefix/suffix formatting.
         */

        plugin.yml:
        \`\`\`
        name: MyPlugin
        version: 1.0
        main: com.example.MyPlugin
        api-version: '1.20'
        softdepend: [ajLeaderboards]
        \`\`\`

        ============================================================================
        ENTRY POINT
        ============================================================================
        \`\`\`java
        import us.ajg0702.leaderboards.LeaderboardPlugin;
        import us.ajg0702.leaderboards.boards.TopManager;
        import us.ajg0702.leaderboards.boards.StatEntry;
        import us.ajg0702.leaderboards.boards.TimedType;

        TopManager top = LeaderboardPlugin.getInstance().getTopManager();
        \`\`\`

        ============================================================================
        TopManager
        ============================================================================
        StatEntry getStat(int position, String board, TimedType type)
          // The row at a 1-based position. Returns a StatEntry whose player is null when the board
          // has fewer entries than that.
        StatEntry getStatEntry(OfflinePlayer player, String board, TimedType type)
          // That player's own position + score on the board.
        List<String> getBoards()          // the boards currently loaded
        List<String> fetchBoards()        // re-read from storage (BLOCKING — off the main thread)
        void fetchBoardsAsync()
        long getLastReset(String board, TimedType type)   // epoch millis of the last period reset

        StatEntry (us.ajg0702.leaderboards.boards):
        int getPosition(); String getBoard(); TimedType getType()
        double getScore()
        boolean hasPlayer()                       // false = empty slot / unknown player
        UUID getPlayerID(); String getPlayerName(); String getPlayerDisplayName()
        String getPrefix(); String getSuffix()    // the configured rank formatting
        String getSkin()
        void changeScore(double score, String prefix, String suffix)
        static final String BOARD_DOES_NOT_EXIST; static final String AN_ERROR_OCCURRED;
          // getPlayerName() returns one of these sentinels when the board name is wrong or the
          // lookup failed — check hasPlayer() rather than comparing strings.

        TimedType: ALLTIME, HOURLY, DAILY, WEEKLY, MONTHLY, YEARLY

        ============================================================================
        EXAMPLES
        ============================================================================
        --- Build a top-10 ---
        \`\`\`java
        for (int position = 1; position <= 10; position++) {
            StatEntry entry = top.getStat(position, "myplugin_kills", TimedType.ALLTIME);
            if (!entry.hasPlayer()) break;                       // fewer than 10 players ranked
            player.sendMessage(position + ". " + entry.getPlayerName() + " — " + (long) entry.getScore());
        }
        \`\`\`

        --- Where does this player rank? ---
        \`\`\`java
        StatEntry mine = top.getStatEntry(player, "myplugin_kills", TimedType.WEEKLY);
        if (mine.hasPlayer()) {
            player.sendMessage("You are #" + mine.getPosition() + " this week with " + (long) mine.getScore());
        } else {
            player.sendMessage("You aren't ranked yet.");
        }
        \`\`\`

        --- Check the board exists first ---
        \`\`\`java
        if (!top.getBoards().contains("myplugin_kills")) {
            getLogger().warning("Board not set up — run /ajlb add myplugin_kills");
            return;
        }
        \`\`\`

        --- When did the weekly period roll over? ---
        \`\`\`java
        long lastReset = top.getLastReset("myplugin_kills", TimedType.WEEKLY);
        \`\`\`

        ============================================================================
        EVENTS (us.ajg0702.leaderboards.api.events)
        ============================================================================
        UpdatePlayerEvent          — a player's cached value is being updated. Use it to veto or
                                     observe sampling for a specific player.
        PreTimedTypeResetEvent     — a timed board is about to reset (the hour/day/week rolled over).
                                     The place to hand out "top of the week" rewards BEFORE the
                                     scores are wiped. Read the standings here, not after.

        \`\`\`java
        @EventHandler
        public void onReset(PreTimedTypeResetEvent event) {
            StatEntry winner = LeaderboardPlugin.getInstance().getTopManager()
                    .getStat(1, event.getBoard(), event.getType());
            if (winner.hasPlayer()) rewardWeeklyWinner(winner.getPlayerID());
        }
        \`\`\`

        ============================================================================
        PLACEHOLDERS
        ============================================================================
        Most integrations never touch Java at all — the plugin exposes everything as placeholders:
          %ajlb_top_name_<type>_<position>_<board>%
          %ajlb_top_value_<type>_<position>_<board>%
          %ajlb_position_<type>_<board>%          — the reading player's own position
          %ajlb_value_<type>_<board>%
        If your plugin already renders configurable menus/holograms, letting the admin use these is
        simpler than calling the API.

        ============================================================================
        PRACTICAL NOTES
        ============================================================================
        - getStat/getStatEntry read from ajLeaderboards' CACHE, so they are fast and safe on the main
          thread — but a cache miss can trigger a fetch. Do not call them in a tick loop; build your
          top-10 once when a menu opens.
        - fetchBoards() blocks on storage (SQLite/MySQL). Call it asynchronously, or use
          fetchBoardsAsync().
        - Always check hasPlayer() before using getPlayerName()/getPlayerID(). Empty positions and
          error states come back as a StatEntry with the sentinel names, not as null.
        - A board must be registered by the server admin (/ajlb add <placeholder>) before your code
          can read it. Your plugin cannot create boards through this API — document the command for
          the admin instead.
        - Scores are doubles because they come from placeholder text. Cast/format them for display;
          a "kills" board is still a double under the hood.
        - Timed boards reset on ajLeaderboards' schedule. If you hand out rewards, do it from
          PreTimedTypeResetEvent — after the reset the winning scores are gone.
    `
};
