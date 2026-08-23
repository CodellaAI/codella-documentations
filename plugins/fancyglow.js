module.exports = {
    name: 'FancyGlow',
    description: 'FancyGlow gives players a coloured glowing outline they pick from a GUI, including rainbow and flashing modes. Its API is a handful of methods to read, set and clear a player\'s glow colour and toggle the animated modes — the hook for making a rank, a cosmetic reward, or a game state light a player up.',
    pluginId: 'FancyGlow',
    mavenIntegration: `
        <repositories>
            <repository>
                <id>jitpack</id>
                <url>https://jitpack.io/</url>
            </repository>
        </repositories>
        <dependencies>
            <dependency>
                <groupId>com.github.hhitt</groupId>
                <artifactId>FancyGlow</artifactId>
                <version>2.10.3</version>
                <scope>provided</scope>
            </dependency>
        </dependencies>
    `,
    usage: `
        /**
         * FancyGlow — hhitt.fancyglow.api
         *
         * Glow colour in Minecraft is driven by the SCOREBOARD TEAM a player is on, which is why the
         * API only accepts the 16 vanilla ChatColor values — those are the only legal team colours.
         */

        plugin.yml:
        \`\`\`
        name: MyPlugin
        version: 1.0
        main: com.example.MyPlugin
        api-version: '1.20'
        softdepend: [FancyGlow]
        \`\`\`

        ============================================================================
        ENTRY POINT
        ============================================================================
        \`\`\`java
        import hhitt.fancyglow.api.FancyGlowAPI;
        import org.bukkit.Bukkit;
        import org.bukkit.plugin.RegisteredServiceProvider;

        RegisteredServiceProvider<FancyGlowAPI> rsp =
                Bukkit.getServicesManager().getRegistration(FancyGlowAPI.class);
        if (rsp == null) return;                 // FancyGlow not installed/enabled
        FancyGlowAPI glow = rsp.getProvider();
        \`\`\`

        ============================================================================
        FancyGlowAPI
        ============================================================================
        String getPlayerGlowColor(Player player)         // the colour code, or null when not glowing
        String getPlayerGlowColorName(Player player)     // the human-readable name ("RED")
        void setPlayerGlowColor(Player player, ChatColor color)
        void removePlayerGlow(Player player)
        boolean hasGlow(Player player)
        boolean hasRainbowMode(Player player)
        void setRainbowMode(Player player, boolean enabled)
        boolean hasFlashingMode(Player player)
        void setFlashingMode(Player player, boolean enabled)

        ============================================================================
        EXAMPLES
        ============================================================================
        --- Light a player up while an event runs ---
        \`\`\`java
        import org.bukkit.ChatColor;

        glow.setPlayerGlowColor(player, ChatColor.GOLD);
        // ... later ...
        glow.removePlayerGlow(player);
        \`\`\`

        --- Only override if they are not already glowing ---
        \`\`\`java
        if (!glow.hasGlow(player)) {
            glow.setPlayerGlowColor(player, ChatColor.RED);
        }
        \`\`\`

        --- Restore what they had ---
        \`\`\`java
        String previous = glow.getPlayerGlowColor(player);          // may be null
        glow.setPlayerGlowColor(player, ChatColor.AQUA);            // your temporary colour
        // ...
        if (previous != null) {
            ChatColor back = ChatColor.getByChar(previous.charAt(previous.length() - 1));
            if (back != null) glow.setPlayerGlowColor(player, back);
        } else {
            glow.removePlayerGlow(player);
        }
        \`\`\`

        --- Animated modes as a rank perk ---
        \`\`\`java
        if (player.hasPermission("myplugin.rainbow")) glow.setRainbowMode(player, true);
        if (player.hasPermission("myplugin.flash"))   glow.setFlashingMode(player, true);
        \`\`\`

        ============================================================================
        PRACTICAL NOTES
        ============================================================================
        - Only the 16 vanilla ChatColor values are valid glow colours. Passing a formatting code
          (BOLD, ITALIC, RESET) or expecting a hex colour does not work — glow rides on scoreboard
          teams, and team colours are limited to those 16.
        - Glow uses scoreboard teams. Any other plugin that assigns teams (TAB nametags, a minigame's
          own team logic, some anti-cheat/nametag plugins) will fight FancyGlow over the same player.
          If glow keeps getting reset, that conflict is the cause.
        - getPlayerGlowColor returns null when the player is not glowing — null-check before parsing.
        - Rainbow and flashing modes run their own repeating task per player. Turning them on for a
          large number of players at once is measurably more expensive than a static colour.
        - Prefer the ServicesManager lookup over casting the plugin instance: it fails cleanly when
          FancyGlow is absent and does not tie you to the implementation class.
        - Glow is visible to everyone. There is no per-viewer glow in this API — if you need "only
          my team sees them glow", you need packet-level entity metadata (ProtocolLib) instead.
    `
};
