module.exports = {
    name: 'NBT API',
    description: 'Item-NBT-API by tr7zw — read and write NBT on items, entities, block entities, chunks and .dat files without touching NMS, across every Minecraft version (1.7 to latest). The standard way to stamp custom persistent data onto an ItemStack, and the tool of choice whenever PersistentDataContainer is not enough (vanilla tags, item components, GameProfile skulls, offline .dat editing).',
    pluginId: 'NBTAPI',
    mavenIntegration: `
        <repositories>
            <repository>
                <id>codemc</id>
                <url>https://repo.codemc.io/repository/maven-public/</url>
            </repository>
        </repositories>
        <dependencies>
            <!-- Use 'provided' when the server runs the NBTAPI plugin (depend: [NBTAPI]).
                 If you would rather bundle it, use 'compile' + maven-shade-plugin and RELOCATE
                 de.tr7zw.changeme.nbtapi (see SHADING below) — never shade it unrelocated. -->
            <dependency>
                <groupId>de.tr7zw</groupId>
                <artifactId>item-nbt-api-plugin</artifactId>
                <version>2.15.1</version>
                <scope>provided</scope>
            </dependency>
        </dependencies>
    `,
    usage: `
        /**
         * NBT API — de.tr7zw.nbtapi
         *
         * Two ways to consume it:
         *  - PLUGIN mode (recommended, what this doc assumes): the server runs the NBTAPI plugin,
         *    you add depend: [NBTAPI] in plugin.yml and use the package de.tr7zw.nbtapi.
         *  - SHADED mode: you bundle it into your jar. Then the package is
         *    de.tr7zw.changeme.nbtapi and you MUST relocate it (see SHADING).
         *
         * Everything below is the plugin-mode package. If you shade instead, replace
         * 'de.tr7zw.nbtapi' with your relocated package everywhere.
         */

        plugin.yml:
        \`\`\`
        name: MyPlugin
        version: 1.0
        main: com.example.MyPlugin
        api-version: '1.20'
        depend: [NBTAPI]
        \`\`\`

        ============================================================================
        THE MODERN API — the NBT class (USE THIS)
        ============================================================================
        de.tr7zw.nbtapi.NBT is a static facade. It hands you a short-lived handle inside a lambda
        and applies the changes when the lambda returns. This is the ONLY API you should use in new
        code: it is version-safe, it works on 1.20.5+ item components, and it can't leak a stale
        handle the way the older NBTItem could.

        Read (never modifies anything):
        static ReadableNBT readNbt(ItemStack item)
        static void       get(ItemStack item, Consumer<ReadableItemNBT> handler)
        static <T> T      get(ItemStack item, Function<ReadableItemNBT, T> handler)   // returns your value
        static void       get(Entity entity, Consumer<ReadableNBT> handler)
        static <T> T      get(Entity entity, Function<ReadableNBT, T> handler)
        static void       get(BlockState block, Consumer<ReadableNBT> handler)
        static <T> T      get(BlockState block, Function<ReadableNBT, T> handler)
        static <T> T      getPersistentData(Entity entity, Function<ReadableNBT, T> handler)
        static <T> T      getPersistentData(BlockState block, Function<ReadableNBT, T> handler)

        Modify (the change is applied when the lambda returns):
        static void       modify(ItemStack item, Consumer<ReadWriteItemNBT> handler)
        static <T> T      modify(ItemStack item, Function<ReadWriteItemNBT, T> handler)
        static void       modify(Entity entity, Consumer<ReadWriteNBT> handler)
        static <T> T      modify(Entity entity, Function<ReadWriteNBT, T> handler)
        static void       modify(BlockState block, Consumer<ReadWriteNBT> handler)
        static <T> T      modify(BlockState block, Function<ReadWriteNBT, T> handler)
        static void       modifyPersistentData(Entity entity, Consumer<ReadWriteNBT> handler)
        static void       modifyPersistentData(BlockState block, Consumer<ReadWriteNBT> handler)

        Item COMPONENTS (1.20.5+ data components — max_stack_size, food, custom_data, …):
        static void       modifyComponents(ItemStack item, Consumer<ReadWriteNBT> handler)
        static <T> T      modifyComponents(ItemStack item, Function<ReadWriteNBT, T> handler)
        static void       getComponents(ItemStack item, Consumer<ReadableNBT> handler)
        static <T> T      getComponents(ItemStack item, Function<ReadableNBT, T> handler)

        Standalone / conversion:
        static ReadWriteNBT createNBTObject()                    // a free-floating compound
        static ReadWriteNBT parseNBT(String mojangson)           // "{display:{Name:'...'}}"
        static ReadWriteNBT readNBT(InputStream stream)
        static ReadWriteNBT wrapNMSTag(Object nmsCompound)
        static ReadWriteNBT itemStackToNBT(ItemStack item)       // serialise an item
        static ItemStack    itemStackFromNBT(ReadableNBT nbt)    // and back
        static ReadWriteNBT itemStackArrayToNBT(ItemStack[] items)
        static ItemStack[]  itemStackArrayFromNBT(ReadableNBT nbt)
        static ReadWriteNBT gameProfileToNBT(GameProfile profile)
        static GameProfile  gameProfileFromNBT(ReadableNBT nbt)
        static boolean      preloadApi()                         // warm the reflection cache in onEnable

        Files (.dat, gzipped NBT):
        static NBTFileHandle getFileHandle(File file) throws IOException  // read + save() back
        static ReadWriteNBT  readFile(File file) throws IOException
        static void          writeFile(File file, ReadWriteNBT nbt) throws IOException

        ============================================================================
        THE HANDLES
        ============================================================================
        ReadableNBT (de.tr7zw.nbtapi.iface) — everything you can read:
        String getString(String key); Integer getInteger(String key); Double getDouble(String key);
        Byte getByte(String key); Short getShort(String key); Long getLong(String key);
        Float getFloat(String key); Boolean getBoolean(String key);
        byte[] getByteArray(String key); int[] getIntArray(String key); long[] getLongArray(String key);
        UUID getUUID(String key); ItemStack getItemStack(String key); ItemStack[] getItemStackArray(String key);
        boolean hasTag(String key); boolean hasTag(String key, NBTType type);
        Set<String> getKeys();
        NBTType getType(String key); NBTType getListType(String key);
        ReadableNBT getCompound(String key);                     // null when missing
        ReadableNBTList<String> getStringList(String key);       // also Integer/Float/Double/Long/UUID/int[]
        ReadableNBTList<ReadWriteNBT> getCompoundList(String key);
        <T> T getOrDefault(String key, T fallback);              // NEVER returns null — prefer this
        <T> T getOrNull(String key, Class<?> type);
        ReadableNBT resolveCompound(String path);                // dotted path: "a.b.c", null if absent
        <T> T resolveOrDefault(String path, T fallback);         // dotted path + fallback
        <T> T resolveOrNull(String path, Class<?> type);
        <E extends Enum<E>> E getEnum(String key, Class<E> type);
        void writeCompound(OutputStream out);
        ReadWriteNBT extractDifference(ReadableNBT other);       // what this has that 'other' doesn't
        String toString();                                       // Mojangson

        ReadWriteNBT extends ReadableNBT — everything you can write:
        void setString/setInteger/setDouble/setByte/setShort/setLong/setFloat/setBoolean(String, value)
        void setByteArray(String, byte[]); void setIntArray(String, int[]); void setLongArray(String, long[]);
        void setUUID(String, UUID); void setItemStack(String, ItemStack); void setItemStackArray(String, ItemStack[]);
        <E extends Enum<?>> void setEnum(String key, E value);
        void removeKey(String key); void clearNBT();
        void mergeCompound(ReadableNBT other);                   // deep merge another compound in
        ReadWriteNBT getOrCreateCompound(String key);            // never null — the way to nest
        ReadWriteNBT resolveOrCreateCompound(String path);       // dotted path, creating as it goes
        ReadWriteNBTList<String> getStringList(String key);      // mutable lists (also Integer/Float/…)
        ReadWriteNBTCompoundList getCompoundList(String key);    // .addCompound() to append

        ReadableItemNBT extends ReadableNBT: boolean hasNBTData();
        ReadWriteItemNBT extends ReadWriteNBT, ReadableItemNBT:
          boolean hasCustomNbtData();          // is there anything under the custom-data component?
          void clearCustomNBT();
          void modifyMeta(BiConsumer<ReadableNBT, ItemMeta> handler)                 // Bukkit meta + NBT together
          <T extends ItemMeta> void modifyMeta(Class<T> metaType, BiConsumer<ReadableNBT, T> handler)

        NBTFileHandle extends ReadWriteNBT: void save() throws IOException; File getFile();

        NBTType enum (de.tr7zw.nbtapi): NBTTagEnd, NBTTagByte, NBTTagShort, NBTTagInt, NBTTagLong,
          NBTTagFloat, NBTTagDouble, NBTTagByteArray, NBTTagString, NBTTagList, NBTTagCompound,
          NBTTagIntArray, NBTTagLongArray. int getId(); String getName();
          static NBTType valueOf(int id); static NBTType fromName(String name);

        ============================================================================
        EXAMPLES
        ============================================================================
        --- Stamp a plugin tag on an item and read it back ---
        \`\`\`java
        import de.tr7zw.nbtapi.NBT;

        // WRITE — modify() gives you a handle and applies the change when the lambda returns.
        NBT.modify(item, nbt -> {
            nbt.setString("myplugin_id", "firesword");
            nbt.setInteger("myplugin_level", 7);
            nbt.setUUID("myplugin_owner", player.getUniqueId());
        });

        // READ — get() with a Function returns whatever the lambda returns.
        String id = NBT.get(item, nbt -> (String) nbt.getOrDefault("myplugin_id", ""));
        int level = NBT.get(item, nbt -> (int) nbt.getOrDefault("myplugin_level", 0));

        boolean isMine = NBT.get(item, nbt -> nbt.hasTag("myplugin_id"));
        \`\`\`

        {IMPORTANT} \`modify\` on an ItemStack edits THAT ItemStack in place — it does not return a
        copy. If the item came from an inventory snapshot, set it back into the inventory afterwards.

        --- Nested compounds and a dotted path ---
        \`\`\`java
        NBT.modify(item, nbt -> {
            var stats = nbt.getOrCreateCompound("myplugin");     // never null
            stats.setInteger("kills", 12);
            stats.setDouble("damage", 4.5);
        });

        int kills = NBT.get(item, nbt -> (int) nbt.resolveOrDefault("myplugin.kills", 0));
        \`\`\`

        --- A list of compounds (e.g. applied gems) ---
        \`\`\`java
        NBT.modify(item, nbt -> {
            var gems = nbt.getCompoundList("myplugin_gems");
            var gem = gems.addCompound();
            gem.setString("type", "ruby");
            gem.setInteger("tier", 3);
        });

        List<String> types = NBT.get(item, nbt -> {
            List<String> out = new ArrayList<>();
            nbt.getCompoundList("myplugin_gems").forEach(c -> out.add(c.getString("type")));
            return out;
        });
        \`\`\`

        --- Entities and block entities ---
        \`\`\`java
        // Entity NBT (vanilla tags — NoAI, Silent, attributes, …)
        NBT.modify(zombie, nbt -> nbt.setBoolean("NoAI", true));

        // Entity PERSISTENT data (survives reload, same store as Bukkit's PersistentDataContainer)
        NBT.modifyPersistentData(zombie, nbt -> nbt.setString("myplugin_spawner", "wave3"));
        String wave = NBT.getPersistentData(zombie, nbt -> nbt.getString("myplugin_spawner"));

        // Block entities (chests, signs, spawners) — pass the BlockState
        BlockState state = block.getState();
        NBT.modify(state, nbt -> nbt.setString("myplugin_owner", player.getName()));
        state.update();                                        // Bukkit still needs the update()
        \`\`\`

        --- 1.20.5+ item components ---
        \`\`\`java
        // Components are a DIFFERENT tree from legacy item NBT. Use modifyComponents for them.
        NBT.modifyComponents(item, comps -> {
            comps.setInteger("minecraft:max_stack_size", 1);
            comps.getOrCreateCompound("minecraft:custom_data").setString("myplugin_id", "firesword");
        });
        \`\`\`

        --- Serialise items into your own config/database ---
        \`\`\`java
        String serialized = NBT.itemStackToNBT(item).toString();       // Mojangson string
        ItemStack restored = NBT.itemStackFromNBT(NBT.parseNBT(serialized));

        // Whole inventories in one tag:
        ReadWriteNBT bag = NBT.itemStackArrayToNBT(player.getInventory().getContents());
        ItemStack[] back = NBT.itemStackArrayFromNBT(bag);
        \`\`\`

        --- Custom-textured player heads ---
        \`\`\`java
        GameProfile profile = new GameProfile(UUID.randomUUID(), "head");
        profile.getProperties().put("textures", new Property("textures", base64Texture));
        ReadWriteNBT skull = NBT.gameProfileToNBT(profile);
        NBT.modifyComponents(headItem, comps -> comps.set("minecraft:profile", skull));
        \`\`\`

        --- Editing an offline .dat file ---
        \`\`\`java
        NBTFileHandle file = NBT.getFileHandle(new File(worldFolder, "playerdata/" + uuid + ".dat"));
        file.setInteger("myplugin_visits", file.getOrDefault("myplugin_visits", 0) + 1);
        file.save();
        \`\`\`

        ============================================================================
        LEGACY CLASSES (you will see them in old code — do not write new code with them)
        ============================================================================
        NBTItem, NBTEntity, NBTTileEntity, NBTBlock, NBTChunk, NBTContainer, NBTFile,
        NBTCompound, NBTList, NBTCompoundList, NBTPersistentDataContainer.
        The pattern was: new NBTItem(item) -> set... -> item = nbtItem.getItem(), or
        new NBTItem(item, true) for direct apply. They still work, but they are wrappers that can go
        stale, several are no-ops on 1.20.5+ components, and the maintainer's guidance is to migrate
        to the NBT.modify/NBT.get lambdas above. Only touch them when editing existing code.

        ============================================================================
        NOTES THAT SAVE YOU A BUG REPORT
        ============================================================================
        - Call NBT.preloadApi() once in onEnable. The first NBT call otherwise pays the whole
          reflection-cache build cost, which on a busy tick shows up as a spike.
        - Prefer getOrDefault(key, fallback) over getString/getInteger: the typed getters return
          null / 0 for a missing key and getOrDefault never surprises you.
        - NBT calls are reflection into NMS. Cache the value in your own object if you read it in a
          hot loop (per-tick, per-block-break); don't re-read the item's NBT thousands of times.
        - Items ONLY. NBT on an ItemStack never survives being crafted/smelted into a different item,
          and vanilla anvils/grindstones can drop unknown tags on some versions. Keep the item's
          identity in the tag, not in its lore.
        - Thread safety: reading NBT off the main thread is generally fine for a snapshot ItemStack,
          but anything backed by a live Entity/BlockState must be on the main thread.
        - PersistentDataContainer (Bukkit) vs NBT API: if plain string/int keys on an item or entity
          are all you need and you target 1.14+, Bukkit's PersistentDataContainer needs no dependency
          at all. Reach for the NBT API when you need vanilla tags, components, cross-version support,
          skull profiles, item serialisation or .dat editing.

        ============================================================================
        SHADING (only if you do NOT want to require the NBTAPI plugin)
        ============================================================================
        Change the dependency scope to compile and relocate it — an unrelocated shade collides with
        every other plugin that shades the same library and breaks all of them:
        \`\`\`xml
        <plugin>
          <groupId>org.apache.maven.plugins</groupId>
          <artifactId>maven-shade-plugin</artifactId>
          <version>3.5.1</version>
          <executions><execution><phase>package</phase><goals><goal>shade</goal></goals></execution></executions>
          <configuration>
            <relocations>
              <relocation>
                <pattern>de.tr7zw.changeme.nbtapi</pattern>
                <shadedPattern>com.example.myplugin.nbtapi</shadedPattern>
              </relocation>
            </relocations>
          </configuration>
        </plugin>
        \`\`\`
        In shaded mode the artifact is de.tr7zw:item-nbt-api (not -plugin), the source package is
        de.tr7zw.changeme.nbtapi, you drop depend: [NBTAPI] from plugin.yml, and you import from your
        relocated package.
    `
};
