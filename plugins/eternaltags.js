module.exports = {
    name: 'EternalTags',
    description: 'EternalTags by Oribuin gives players cosmetic chat/nametag tags they unlock by permission and equip from a GUI. Its API lets a plugin read a player\'s active tag, equip/clear tags in code, create and delete tags at runtime, manage favourites, and list which tags a player has access to — the hook for reward crates, ranks and quest systems that hand out tags.',
    pluginId: 'EternalTags',
    dependencies: `
        PlaceholderAPI (optional, for %eternaltags_tag_formatted% and friends)
        Vault (optional, for group-based default tags)
    `,
    mavenIntegration: `
        <repositories>
            <repository>
                <id>jitpack</id>
                <url>https://jitpack.io/</url>
            </repository>
        </repositories>
        <dependencies>
            <dependency>
                <groupId>com.github.Oribuin</groupId>
                <artifactId>EternalTags</artifactId>
                <version>1.3.3</version>
                <scope>provided</scope>
            </dependency>
        </dependencies>
    `,
    usage: `
        /**
         * EternalTags — xyz.oribuin.eternaltags
         *
         * EternalTags is a RoseGarden plugin: its functionality lives in "managers" you fetch from
         * the plugin instance. Everything you want is on TagsManager.
         *
         * A Tag is a config-defined object: an id, a display name, the actual tag string (with
         * colour codes), a permission, a GUI icon and an optional category.
         */

        plugin.yml:
        \`\`\`
        name: MyPlugin
        version: 1.0
        main: com.example.MyPlugin
        api-version: '1.20'
        softdepend: [EternalTags]
        \`\`\`

        ============================================================================
        ENTRY POINT
        ============================================================================
        \`\`\`java
        import xyz.oribuin.eternaltags.EternalTags;
        import xyz.oribuin.eternaltags.manager.TagsManager;
        import xyz.oribuin.eternaltags.obj.Tag;

        TagsManager tags = EternalTags.getInstance().getManager(TagsManager.class);
        \`\`\`

        ============================================================================
        TagsManager
        ============================================================================
        --- Reading a player's tag ---
        Tag getUserTag(Player player)                     // their ACTIVE tag, or null
        Tag getUserTag(UUID playerId)
        Tag getOfflineUserTag(OfflinePlayer player)
        Tag getTagFromUUID(UUID playerId)
        Tag getDefaultTag(Player player)                  // the tag they get with none equipped
        boolean usingGroupDefaults()

        --- Equipping / clearing ---
        void clearTag(UUID playerId)                      // unequip whatever they have
        (equip via the Tag itself: tag.equip(player) / tag.unequip(player))

        --- Looking tags up ---
        Tag getTagFromId(String id)                       // null when unknown
        boolean checkTagExists(String id)
        List<Tag> getPlayerTags(Player player)            // every tag they have permission for
        List<Tag> getTagsInCategory(Category category)

        --- Creating / deleting at runtime ---
        void saveTag(Tag tag)                             // create or update (persists)
        void saveToConfig(Tag tag)                        // write it into tags.yml
        void saveTags(Map<String, Tag> tags)
        void deleteTag(Tag tag); void deleteTag(String id)
        void updateActiveTag(Tag tag)                     // refresh everyone currently wearing it
        void loadTags(); void reload()

        --- Favourites ---
        void addFavourite(UUID playerId, Tag tag)
        void removeFavourite(UUID playerId, Tag tag)
        Map<String, Tag> getUsersFavourites(UUID playerId)

        ============================================================================
        Tag (xyz.oribuin.eternaltags.obj)
        ============================================================================
        Tag(String id, String name, String tag)
        void equip(Player player)                         // make it their active tag
        void unequip(Player player)
        boolean hasPermission(Player player)              // does this player own it?
        String getId()
        String getName(); void setName(String)            // display name in the GUI
        String getTag(); void setTag(String)              // the actual tag text, with colour codes
        String getPermission(); void setPermission(String)
        List<String> getDescription(); void setDescription(List<String>)
        int getOrder(); void setOrder(int)                // GUI sort order
        ItemStack getIcon(); void setIcon(ItemStack); void setIcon(Material)
        String getCategory(); void setCategory(String)
        boolean isHandIcon(); void setHandIcon(boolean)

        ============================================================================
        EXAMPLES
        ============================================================================
        --- Read the player's active tag ---
        \`\`\`java
        Tag tag = tags.getUserTag(player);
        String display = tag != null ? tag.getTag() : "";
        player.sendMessage(display + " " + player.getName() + ": hello");
        \`\`\`

        --- Give a tag as a reward and equip it ---
        \`\`\`java
        Tag reward = tags.getTagFromId("champion");
        if (reward != null) {
            // Ownership is permission-based — grant the permission through your permissions plugin:
            // luckperms user <player> permission set eternaltags.tag.champion true
            if (reward.hasPermission(player)) reward.equip(player);
        }
        \`\`\`

        --- Create a tag from code ---
        \`\`\`java
        Tag custom = new Tag("winner", "Winner", "&6&l[WINNER]");
        custom.setPermission("eternaltags.tag.winner");
        custom.setDescription(List.of("&7Awarded for winning the event."));
        custom.setIcon(Material.GOLDEN_APPLE);
        custom.setOrder(1);
        tags.saveTag(custom);
        tags.saveToConfig(custom);      // also persist it into tags.yml so it survives a reload
        \`\`\`

        --- List what a player can wear ---
        \`\`\`java
        for (Tag t : tags.getPlayerTags(player)) {
            player.sendMessage(t.getId() + " -> " + t.getTag());
        }
        \`\`\`

        --- Clear on some event ---
        \`\`\`java
        tags.clearTag(player.getUniqueId());
        \`\`\`

        ============================================================================
        PLACEHOLDERS
        ============================================================================
        %eternaltags_tag_formatted%      — the active tag, colour-formatted (what you put in chat)
        %eternaltags_tag_stripped%       — the tag without colour codes
        %eternaltags_tag_name%           — its display name
        %eternaltags_tag_id%             — its id
        %eternaltags_total%              — how many tags the player has access to
        %eternaltags_active%             — whether they have one equipped
        Most servers wire the tag into chat by putting %eternaltags_tag_formatted% into their chat
        plugin's format, rather than doing it in code.

        ============================================================================
        PRACTICAL NOTES
        ============================================================================
        - Ownership is PERMISSIONS, not a database list: a player "has" a tag when they hold its
          permission (eternaltags.tag.<id> by default). To grant a tag from code you grant the
          permission through LuckPerms/Vault, then equip it. There is no "giveTag" method.
        - getUserTag(...) returns null when nothing is equipped — always null-check before calling
          getTag() on it.
        - saveTag() persists to EternalTags' data store; saveToConfig() writes the definition into
          tags.yml. Call both when you create a tag that should survive a plugin reload.
        - After changing a Tag object that players are currently wearing, call updateActiveTag(tag)
          so their displayed tag refreshes.
        - EternalTags shades RoseGarden. Fetch managers with getManager(TagsManager.class) on the
          plugin instance — do not try to construct a manager yourself.
        - Keep the imports in an isolated class when you softdepend, and gate on
          \`Bukkit.getPluginManager().isPluginEnabled("EternalTags")\`.
    `
};
