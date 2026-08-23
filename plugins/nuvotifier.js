module.exports = {
    name: 'NuVotifier',
    description: 'NuVotifier (plugin name "Votifier") receives vote notifications from Minecraft server listing sites and fires them as a Bukkit event. Any plugin that hands out vote rewards, vote parties, vote streaks or vote crates listens to VotifierEvent — it is a one-class API and the single standard for vote integration.',
    pluginId: 'Votifier',
    mavenIntegration: `
        <repositories>
            <repository>
                <id>nuvotifier</id>
                <url>https://repo.nuvotifier.com/repository/maven-public/</url>
            </repository>
        </repositories>
        <dependencies>
            <dependency>
                <groupId>com.vexsoftware</groupId>
                <artifactId>nuvotifier-api</artifactId>
                <version>2.7.3</version>
                <scope>provided</scope>
            </dependency>
        </dependencies>
    `,
    usage: `
        /**
         * NuVotifier — com.vexsoftware.votifier
         *
         * The whole API is: listen to VotifierEvent, read the Vote, give a reward.
         * Note the plugin's NAME is "Votifier" (not "NuVotifier") — that is what goes in
         * softdepend/depend and what isPluginEnabled() expects.
         */

        plugin.yml:
        \`\`\`
        name: MyVoteRewards
        version: 1.0
        main: com.example.MyVoteRewards
        api-version: '1.20'
        softdepend: [Votifier]      # softdepend so your plugin still loads without it
        \`\`\`

        ============================================================================
        THE EVENT
        ============================================================================
        com.vexsoftware.votifier.model.VotifierEvent extends org.bukkit.event.Event
          VotifierEvent(Vote vote)
          Vote getVote()
        Not cancellable — the vote already happened on the listing site.

        com.vexsoftware.votifier.model.Vote
          String getServiceName()      // the voting site, e.g. "minecraft-mp.com" — matches the
                                       // serviceName configured in that site's Votifier settings
          String getUsername()         // the name the player typed on the site (NOT guaranteed to be
                                       // an online player, correct case, or even a real account)
          String getAddress()          // the voter's IP as reported by the site
          String getTimeStamp()        // the site's timestamp — a String, format varies by site
          byte[] getAdditionalData()   // extra payload some sites/forwarders attach; usually null
          JsonObject serialize()
          setServiceName/setUsername/setAddress/setTimeStamp   // for forging votes in tests

        ============================================================================
        BASIC LISTENER
        ============================================================================
        \`\`\`java
        import com.vexsoftware.votifier.model.Vote;
        import com.vexsoftware.votifier.model.VotifierEvent;
        import org.bukkit.Bukkit;
        import org.bukkit.OfflinePlayer;
        import org.bukkit.entity.Player;
        import org.bukkit.event.EventHandler;
        import org.bukkit.event.Listener;

        public class VoteListener implements Listener {

            private final MyPlugin plugin;
            public VoteListener(MyPlugin plugin) { this.plugin = plugin; }

            @EventHandler
            public void onVote(VotifierEvent event) {
                Vote vote = event.getVote();
                String name = vote.getUsername();
                if (name == null || name.isEmpty()) return;       // some sites send empty names

                Player player = Bukkit.getPlayerExact(name);
                if (player != null) {
                    giveReward(player, vote.getServiceName());
                } else {
                    // Offline voter: queue the reward and hand it out on their next join.
                    plugin.queueReward(name, vote.getServiceName());
                }
            }
        }
        \`\`\`
        Register it: \`getServer().getPluginManager().registerEvents(new VoteListener(this), this);\`

        ============================================================================
        THREADING — READ THIS
        ============================================================================
        NuVotifier receives votes on a NETTY thread and, depending on its config, may fire
        VotifierEvent ASYNCHRONOUSLY. Never assume you are on the main thread:

        \`\`\`java
        @EventHandler
        public void onVote(VotifierEvent event) {
            Vote vote = event.getVote();
            // Anything touching the Bukkit world, inventories, or dispatching a command MUST be sync:
            Bukkit.getScheduler().runTask(plugin, () -> {
                Player player = Bukkit.getPlayerExact(vote.getUsername());
                if (player == null) return;
                Bukkit.dispatchCommand(Bukkit.getConsoleSender(),
                        "give " + player.getName() + " diamond 1");
            });
        }
        \`\`\`
        Database writes and HTTP calls are the opposite: keep those OFF the main thread.

        ============================================================================
        PATTERNS THAT MATTER
        ============================================================================
        --- 1. Offline voters (the most common bug) ---
        Most votes arrive while the player is offline. Store the pending reward keyed by the
        lowercase username and grant it on PlayerJoinEvent:
        \`\`\`java
        @EventHandler
        public void onJoin(PlayerJoinEvent event) {
            int pending = plugin.takePendingVotes(event.getPlayer().getName().toLowerCase());
            for (int i = 0; i < pending; i++) giveReward(event.getPlayer(), "queued");
        }
        \`\`\`

        --- 2. Usernames are untrusted input ---
        The name comes from a web form on a third-party site. It may have wrong capitalisation, be a
        nickname, or not exist at all. Resolve it case-insensitively, and NEVER interpolate it into a
        command without validating it first:
        \`\`\`java
        if (!vote.getUsername().matches("[A-Za-z0-9_]{1,16}")) return;   // reject anything odd
        \`\`\`
        Skipping this turns a vote listing into command injection on your console.

        --- 3. Per-site rewards ---
        \`\`\`java
        String site = vote.getServiceName();                 // matches your config keys
        ConfigurationSection rewards = plugin.getConfig().getConfigurationSection("sites." + site);
        if (rewards == null) rewards = plugin.getConfig().getConfigurationSection("sites.default");
        \`\`\`

        --- 4. Duplicate/replayed votes ---
        Sites retry when the server was down, and NuVotifier's own vote cache re-delivers on startup.
        If a reward is valuable, de-duplicate on (username, serviceName, timeStamp) for a short window.

        --- 5. Vote party / global counter ---
        \`\`\`java
        int total = plugin.incrementVoteCount();
        if (total % 50 == 0) Bukkit.broadcastMessage("§6Vote party! §e50 votes reached!");
        \`\`\`

        ============================================================================
        TESTING WITHOUT A REAL VOTE
        ============================================================================
        - In game: \`/votifier test <username>\` (NuVotifier ships this command), or
        - In code: fire a forged event yourself —
        \`\`\`java
        Vote fake = new Vote("TestSite", player.getName(), "127.0.0.1",
                             String.valueOf(System.currentTimeMillis()));
        Bukkit.getPluginManager().callEvent(new VotifierEvent(fake));
        \`\`\`

        ============================================================================
        PRACTICAL NOTES
        ============================================================================
        - Plugin name for depend/softdepend and isPluginEnabled is "Votifier", not "NuVotifier".
        - NuVotifier is a drop-in replacement for the original Votifier and fires the same event
          class, so a listener written against this API works with either.
        - On a BungeeCord/Velocity network, votes usually arrive at the proxy and are forwarded to
          backend servers. The backend still sees a normal VotifierEvent, but getAddress() will be
          the proxy's address — do not use it for anti-abuse on a networked setup.
        - If Votifier is a softdepend, keep the VotifierEvent import inside a separate listener class
          that you only register when \`isPluginEnabled("Votifier")\` is true; otherwise the class
          fails to load on servers without it.
    `
};
