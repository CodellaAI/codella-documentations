module.exports = {
    name: 'InteractiveChat',
    description: 'InteractiveChat by LOOHP turns chat into something interactive: players share the item they are holding, their inventory or a map, mention each other, and hover/click placeholders expand inline. Its API lets a plugin build item-display components, send messages that bypass or trigger InteractiveChat processing, register nickname providers for mention matching, and hook the chat pipeline before packets are sent.',
    pluginId: 'InteractiveChat',
    dependencies: `
        ProtocolLib (InteractiveChat rewrites chat packets through it)
    `,
    mavenIntegration: `
        <repositories>
            <repository>
                <id>loohp-repo</id>
                <url>https://repo.loohpjames.com/repository/maven-public/</url>
            </repository>
        </repositories>
        <dependencies>
            <dependency>
                <groupId>com.loohp</groupId>
                <artifactId>InteractiveChat</artifactId>
                <version>4.3.2.0</version>
                <scope>provided</scope>
            </dependency>
        </dependencies>
    `,
    usage: `
        /**
         * InteractiveChat — com.loohp.interactivechat.api
         *
         * Everything useful is static on InteractiveChatAPI.
         *
         * NOTE ON ADVENTURE: InteractiveChat SHADES Adventure into
         * com.loohp.interactivechat.libs.net.kyori.adventure.*. The Component type in these
         * signatures is the SHADED one — it is NOT interchangeable with Paper's
         * net.kyori.adventure.text.Component. Convert through legacy/JSON if you need to cross that
         * boundary, or import the shaded type explicitly.
         */

        plugin.yml:
        \`\`\`
        name: MyPlugin
        version: 1.0
        main: com.example.MyPlugin
        api-version: '1.20'
        softdepend: [InteractiveChat]
        \`\`\`

        ============================================================================
        InteractiveChatAPI — all static
        ============================================================================
        --- Sending ---
        void sendMessage(CommandSender sender, Component component)
          // Send a component and let InteractiveChat process it (placeholders expand).
        void sendMessageUnprocessed(CommandSender sender, String message)
        void sendMessageUnprocessed(CommandSender sender, Component component)
        void sendMessageUnprocessed(CommandSender sender, UUID sender, String message)
        void sendMessageUnprocessed(CommandSender sender, UUID sender, Component component)
          // Send WITHOUT InteractiveChat touching it — use this for messages that must be shown
          // literally (logs, admin output) so a player cannot smuggle placeholders through them.

        String markSender(String message, UUID senderUuid)
          // Tag a chat line with who sent it, so InteractiveChat attributes placeholders/cooldowns
          // to the right player when your plugin builds the chat format itself.

        --- Item display ---
        Component createItemDisplayComponent(Player player, ItemStack item) throws Exception
          // The hoverable item component InteractiveChat itself builds for [item]. Use it to put a
          // real item preview into your own message.

        --- Placeholders ---
        List<Pattern> getPlaceholderList()
        List<ICPlaceholder> getICPlaceholderList()
        long getPlayerPlaceholderCooldown(Player player, ICPlaceholder placeholder)
        long getPlayerPlaceholderCooldown(UUID playerId, ICPlaceholder placeholder)
        void setPlayerPlaceholderCooldown(Player player, ICPlaceholder placeholder, long time)
        void setPlayerPlaceholderCooldown(UUID playerId, ICPlaceholder placeholder, long time)
        boolean isPlaceholderOnCooldown(Player player, ICPlaceholder placeholder)
        boolean isPlaceholderOnCooldown(UUID playerId, ICPlaceholder placeholder, long time)
        long getPlayerUniversalCooldown(Player player); void setPlayerUniversalCooldown(Player, long)
        PlaceholderCooldownManager getPlaceholderCooldownManager()

        --- Sharing ---
        Map<String, Inventory> getItemShareList(InteractiveChatAPI.SharedType type)
        Map<String, ItemStack> getMapShareList()
        String addInventoryToItemShareList(SharedType type, String name, Inventory inv) throws Exception
        String addMapToMapSharedList(String name, ItemStack map)

        --- Nicknames / mentions ---
        void registerNicknameProvider(Plugin plugin, Function<UUID, List<String>> provider)
          // Teach InteractiveChat the extra names a player answers to, so @mentions match the
          // nickname your plugin gives them, not just their real username.

        ============================================================================
        EXAMPLES
        ============================================================================
        --- Put a real item preview into your own message ---
        \`\`\`java
        import com.loohp.interactivechat.api.InteractiveChatAPI;
        import com.loohp.interactivechat.libs.net.kyori.adventure.text.Component;

        try {
            Component item = InteractiveChatAPI.createItemDisplayComponent(player,
                    player.getInventory().getItemInMainHand());
            Component line = Component.text(player.getName() + " found ").append(item);
            for (Player online : Bukkit.getOnlinePlayers()) {
                InteractiveChatAPI.sendMessage(online, line);
            }
        } catch (Exception e) {
            getLogger().warning("Failed to build item component: " + e.getMessage());
        }
        \`\`\`

        --- Send something InteractiveChat must NOT rewrite ---
        \`\`\`java
        // Player-supplied text going to staff: never let it be reprocessed
        InteractiveChatAPI.sendMessageUnprocessed(staff, "[report] " + rawPlayerText);
        \`\`\`

        --- Register nicknames for mentions ---
        \`\`\`java
        InteractiveChatAPI.registerNicknameProvider(this, uuid -> {
            String nick = MyNickPlugin.getNickname(uuid);
            return nick == null ? List.of() : List.of(nick);
        });
        \`\`\`

        --- Attribute a custom chat format to the right sender ---
        \`\`\`java
        String formatted = InteractiveChatAPI.markSender(myFormattedLine, player.getUniqueId());
        \`\`\`

        ============================================================================
        EVENTS (com.loohp.interactivechat.api.events)
        ============================================================================
        PreChatPacketSendEvent          — a chat packet is about to go out; the main interception
                                          point for rewriting what a player sees. Cancellable.
        PostPacketComponentProcessEvent — after InteractiveChat processed a component.
        PlaceholderEvent                — a placeholder is being expanded (base class).
        ItemPlaceholderEvent            — the [item] placeholder fired.
        InventoryPlaceholderEvent       — the [inv]/[ec] placeholder fired.
        PlayerMentionPlayerEvent        — one player mentioned another. Cancellable — use it to
                                          block mentions across teams/worlds.
        ICPlayerJoinEvent / ICPlayerQuitEvent      — InteractiveChat's own player tracking.
        OfflineICPlayerCreationEvent / OfflineICPlayerUpdateEvent — cross-server player data.
        InteractiveChatConfigReloadEvent           — config reloaded; re-read your settings.

        \`\`\`java
        @EventHandler
        public void onMention(PlayerMentionPlayerEvent event) {
            if (!sameTeam(event.getSender(), event.getReceiver())) event.setCancelled(true);
        }
        \`\`\`

        ============================================================================
        PRACTICAL NOTES
        ============================================================================
        - The Adventure classes in these signatures are SHADED
          (com.loohp.interactivechat.libs.net.kyori.adventure.*). Mixing them with Paper's
          net.kyori.adventure.* gives NoSuchMethodError / ClassCastException at runtime. Import the
          shaded package explicitly when calling this API, and convert at the boundary via legacy
          strings or JSON if your plugin uses Paper's Adventure elsewhere.
        - Use sendMessageUnprocessed for anything containing text a player typed. Sending
          player-supplied text through the processing path lets them trigger placeholders in staff
          channels and logs.
        - InteractiveChat requires ProtocolLib and works by rewriting chat packets. If your plugin
          also intercepts chat packets, ordering matters — run at a different ListenerPriority and
          test with both installed.
        - createItemDisplayComponent throws a checked Exception; it can fail on odd/modded items, so
          always wrap it and fall back to a plain text name.
        - Placeholder cooldowns are per player and per placeholder. If your plugin grants a "no
          cooldown" perk, setPlayerPlaceholderCooldown(player, placeholder, 0) is the hook.
        - On a BungeeCord network InteractiveChat has a companion proxy plugin; the OfflineICPlayer*
          events exist because player data is synced across servers. Do not assume the mentioned
          player is on this server.
    `
};
