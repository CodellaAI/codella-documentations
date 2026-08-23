module.exports = {
    name: 'ViaVersion',
    description: 'ViaVersion lets clients on newer (and, with ViaBackwards, older) Minecraft versions join a server running a different version. For plugin authors its API answers one very practical question that Bukkit cannot: what protocol version is THIS player actually on — so you can avoid sending them packets, items or UI their client cannot render.',
    pluginId: 'ViaVersion',
    mavenIntegration: `
        <repositories>
            <repository>
                <id>viaversion</id>
                <url>https://repo.viaversion.com/</url>
            </repository>
        </repositories>
        <dependencies>
            <dependency>
                <groupId>com.viaversion</groupId>
                <artifactId>viaversion-api</artifactId>
                <version>5.0.3</version>
                <scope>provided</scope>
            </dependency>
        </dependencies>
    `,
    usage: `
        /**
         * ViaVersion — com.viaversion.viaversion.api
         *
         * 95% of plugin use is one call:
         *     int protocol = Via.getAPI().getPlayerVersion(player);
         * and comparing it against a ProtocolVersion constant.
         *
         * Everything else (raw packet sending, protocol pipelines) is for plugins that translate
         * protocol themselves and is rarely what an ordinary plugin needs.
         */

        plugin.yml:
        \`\`\`
        name: MyPlugin
        version: 1.0
        main: com.example.MyPlugin
        api-version: '1.20'
        softdepend: [ViaVersion]     # softdepend — your plugin must work without it too
        \`\`\`

        ============================================================================
        ENTRY POINT
        ============================================================================
        \`\`\`java
        import com.viaversion.viaversion.api.Via;
        import com.viaversion.viaversion.api.ViaAPI;
        import com.viaversion.viaversion.api.protocol.version.ProtocolVersion;

        ViaAPI<Player> api = Via.getAPI();
        \`\`\`

        Via (static):
        static ViaAPI getAPI()
        static ViaManager getManager()
        static ViaVersionConfig getConfig()
        static ViaPlatform getPlatform()

        ViaAPI<T> (T is Player on Bukkit):
        int getPlayerVersion(T player)                       // the client's protocol number
        int getPlayerVersion(UUID playerId)
        ProtocolVersion getPlayerProtocolVersion(T player)   // the richer object form
        ProtocolVersion getPlayerProtocolVersion(UUID playerId)
        ServerProtocolVersion getServerVersion()
        boolean isInjected(UUID playerId)                    // is Via handling this connection?
        String getVersion()                                  // the ViaVersion plugin version
        SortedSet<ProtocolVersion> getSupportedProtocolVersions()
        SortedSet<ProtocolVersion> getFullSupportedProtocolVersions()
        UserConnection getConnection(UUID playerId)          // low level
        void sendRawPacket(T player, ByteBuf packet)         // low level
        LegacyViaAPI<T> legacyAPI()

        ProtocolVersion (com.viaversion.viaversion.api.protocol.version):
        Constants: ProtocolVersion.v1_8, v1_12_2, v1_13, v1_16_4, v1_17, v1_18_2, v1_19_4,
                   v1_20, v1_20_5, v1_21, v1_21_4, … (one per protocol bump)
        int getVersion(); String getName()
        static ProtocolVersion getProtocol(int version)
        boolean newerThan(ProtocolVersion other); boolean olderThan(ProtocolVersion other);
        boolean newerThanOrEqualTo(ProtocolVersion other); boolean olderThanOrEqualTo(ProtocolVersion other)

        ============================================================================
        THE PATTERN THAT MATTERS
        ============================================================================
        \`\`\`java
        public int protocolOf(Player player) {
            if (!Bukkit.getPluginManager().isPluginEnabled("ViaVersion")) {
                return -1;                                   // unknown: assume the server version
            }
            return Via.getAPI().getPlayerVersion(player);
        }

        // Gate a feature the old client cannot render:
        ProtocolVersion version = Via.getAPI().getPlayerProtocolVersion(player);
        if (version.olderThan(ProtocolVersion.v1_13)) {
            player.sendMessage("Some features are unavailable on your client version.");
            return;                                          // don't send them 1.13+ blocks/items
        }
        \`\`\`

        --- Real reasons to check ---
        \`\`\`java
        // 1.20.5+ item components vs legacy NBT
        if (Via.getAPI().getPlayerProtocolVersion(player).newerThanOrEqualTo(ProtocolVersion.v1_20_5)) {
            giveComponentItem(player);
        } else {
            giveLegacyItem(player);
        }

        // Custom model data is unreliable on 1.8 clients
        boolean supportsModelData = Via.getAPI().getPlayerVersion(player) >= ProtocolVersion.v1_14.getVersion();

        // Hex colours only exist from 1.16
        boolean hex = Via.getAPI().getPlayerProtocolVersion(player).newerThanOrEqualTo(ProtocolVersion.v1_16);

        // Bigger inventories / new slots behave differently on legacy clients
        if (Via.getAPI().getPlayerVersion(player) <= ProtocolVersion.v1_8.getVersion()) {
            openLegacySafeMenu(player);
        }
        \`\`\`

        ============================================================================
        SAFE INTEGRATION (softdepend)
        ============================================================================
        Keep every ViaVersion import out of your main class so your plugin loads without it:
        \`\`\`java
        public interface VersionResolver {
            int protocolOf(Player player);

            static VersionResolver create() {
                if (Bukkit.getPluginManager().isPluginEnabled("ViaVersion")) {
                    return new ViaResolver();          // the only class importing com.viaversion.*
                }
                return player -> -1;                   // fallback: "same as the server"
            }
        }
        \`\`\`
        Loading a class that references a missing type only fails when that class is loaded, so this
        pattern keeps everything working on servers without ViaVersion.

        ============================================================================
        PRACTICAL NOTES
        ============================================================================
        - getPlayerVersion returns the SERVER's protocol version for a player Via is not handling,
          so a plain equality check against the server version is not proof of anything. Use
          isInjected(uuid) if you need to know Via is actually translating that connection.
        - Do NOT call this during PlayerLoginEvent/AsyncPlayerPreLoginEvent — the connection may not
          be fully set up. PlayerJoinEvent is safe.
        - Cache the value per player (on join) rather than calling it in hot paths; it is cheap, but
          a per-tick lookup for every player is still waste.
        - ViaBackwards and ViaRewind are separate plugins that extend the range downward. Their
          presence does not change this API — you still ask ViaVersion.
        - ViaVersion translates packets, it does not make old clients magically support new features.
          A 1.8 client cannot render a 1.20 item, so version-gating in your own plugin is still your
          responsibility — that is exactly what this API is for.
        - Never assume every player is on the server's version on a Via-enabled network. Item NBT,
          custom model data, hex colours, negative-space fonts and modern inventory sizes are the
          usual things that break for legacy clients.
    `
};
