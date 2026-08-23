module.exports = {
    name: 'ProtocolLib',
    description: 'ProtocolLib gives plugins direct access to the Minecraft protocol: intercept, modify, cancel and send raw packets without writing NMS. Use it for client-side-only illusions (fake blocks, fake entities, disguises, holograms), tab-list and scoreboard control, chat/title manipulation, and anything the Bukkit API cannot express because it never leaves the client.',
    pluginId: 'ProtocolLib',
    mavenIntegration: `
        <repositories>
            <repository>
                <id>dmulloy2-repo</id>
                <url>https://repo.dmulloy2.net/repository/public/</url>
            </repository>
        </repositories>
        <dependencies>
            <dependency>
                <groupId>com.comphenix.protocol</groupId>
                <artifactId>ProtocolLib</artifactId>
                <version>5.3.0</version>
                <scope>provided</scope>
            </dependency>
        </dependencies>
    `,
    usage: `
        /**
         * ProtocolLib — com.comphenix.protocol
         *
         * The mental model: every packet is a PacketContainer, which is a typed view over the NMS
         * packet object. You never name an NMS class. You ask the container for "the 3rd integer"
         * or "the 1st ItemStack" through a StructureModifier, which converts Bukkit types to NMS
         * types and back for you.
         *
         * Packets are read/written on NETTY THREADS, not the main thread. See THREADING.
         */

        plugin.yml:
        \`\`\`
        name: MyPlugin
        version: 1.0
        main: com.example.MyPlugin
        api-version: '1.20'
        depend: [ProtocolLib]        # or softdepend if your plugin works without it
        \`\`\`

        ============================================================================
        ENTRY POINT
        ============================================================================
        \`\`\`java
        import com.comphenix.protocol.ProtocolLibrary;
        import com.comphenix.protocol.ProtocolManager;

        ProtocolManager protocol = ProtocolLibrary.getProtocolManager();
        \`\`\`

        ProtocolManager (com.comphenix.protocol):
        PacketContainer createPacket(PacketType type)              // all fields default-initialised
        PacketContainer createPacket(PacketType type, boolean forceDefaults)
        void sendServerPacket(Player receiver, PacketContainer packet)
        void sendServerPacket(Player receiver, PacketContainer packet, boolean filtered) // filtered=false skips other listeners
        void receiveClientPacket(Player sender, PacketContainer packet, boolean filtered) // fake a packet FROM the client
        void broadcastServerPacket(PacketContainer packet)                                // every online player
        void broadcastServerPacket(PacketContainer packet, Entity entity, boolean includeTracker) // everyone tracking that entity
        void broadcastServerPacket(PacketContainer packet, Location center, int radius)
        void broadcastServerPacket(PacketContainer packet, Collection<? extends Player> targets)
        void addPacketListener(PacketListener listener)
        void removePacketListener(PacketListener listener)
        void removePacketListeners(Plugin plugin)                  // call in onDisable
        ImmutableSet<PacketListener> getPacketListeners()
        int getProtocolVersion(Player player)                      // the client's protocol number
        MinecraftVersion getMinecraftVersion()
        Entity getEntityFromID(World world, int entityId)          // resolve an id seen in a packet
        List<Player> getEntityTrackers(Entity entity)              // who currently sees this entity
        void updateEntity(Entity entity, List<Player> observers)   // force-resend an entity to players
        AsynchronousManager getAsynchronousManager()
        boolean isClosed()

        ============================================================================
        LISTENING TO PACKETS
        ============================================================================
        Extend PacketAdapter and override the direction you care about:
        \`\`\`java
        import com.comphenix.protocol.PacketType;
        import com.comphenix.protocol.events.*;

        protocol.addPacketListener(new PacketAdapter(plugin, ListenerPriority.NORMAL,
                PacketType.Play.Server.CHAT) {

            @Override
            public void onPacketSending(PacketEvent event) {          // SERVER -> CLIENT
                PacketContainer packet = event.getPacket();
                Player receiver = event.getPlayer();
                // ... inspect / rewrite / event.setCancelled(true)
            }

            @Override
            public void onPacketReceiving(PacketEvent event) {        // CLIENT -> SERVER
                // fires for PacketType.Play.Client.* types
            }
        });
        \`\`\`

        PacketAdapter constructors:
        PacketAdapter(Plugin plugin, PacketType... types)
        PacketAdapter(Plugin plugin, Iterable<? extends PacketType> types)
        PacketAdapter(Plugin plugin, ListenerPriority priority, PacketType... types)
        PacketAdapter(Plugin plugin, ListenerPriority priority, Iterable<? extends PacketType> types)
        PacketAdapter(Plugin plugin, ListenerPriority priority, Iterable<? extends PacketType> types, ListenerOptions... options)
        static AdapterParameteters params()                        // builder form (note the typo — it is spelled this way in the library)
        static AdapterParameteters params(Plugin plugin, PacketType... types)

        ListenerPriority: LOWEST, LOW, NORMAL, HIGH, HIGHEST, MONITOR
          Same semantics as Bukkit events. MONITOR is for observing only — never modify there.
          For SENDING packets the order is REVERSED relative to Bukkit intuition: LOWEST runs first
          and MONITOR last, so a MONITOR listener sees the final packet.

        PacketEvent:
        PacketContainer getPacket()          // the live packet — mutate it in place
        PacketType getPacketType()
        Player getPlayer()                   // the receiver (sending) or sender (receiving)
        boolean isServerPacket()
        boolean isCancelled(); void setCancelled(boolean)   // cancel = the packet is never sent/handled
        boolean isAsync(); void setReadOnly(boolean)

        ============================================================================
        READING AND WRITING PACKET FIELDS — StructureModifier
        ============================================================================
        A StructureModifier<T> is an indexed view of every field of type T in the packet, in
        DECLARATION ORDER. read(i) / write(i, value); writes return the modifier so they chain.

        \`\`\`java
        PacketContainer packet = protocol.createPacket(PacketType.Play.Server.ENTITY_TELEPORT);
        packet.getIntegers().write(0, entityId);
        packet.getDoubles().write(0, x).write(1, y).write(2, z);
        packet.getBytes().write(0, (byte) (yaw * 256f / 360f));
        protocol.sendServerPacket(player, packet);
        \`\`\`

        The typed accessors on PacketContainer (all return StructureModifier<...>):
        getBytes(), getBooleans(), getShorts(), getIntegers(), getLongs(), getFloat(), getDoubles(),
        getStrings(), getUUIDs(), getInstants(), getVectors(), getBlocks() (Material),
        getItemModifier() (ItemStack), getItemListModifier() (List<ItemStack>),
        getChatComponents() (WrappedChatComponent), getGameProfiles() (WrappedGameProfile),
        getBlockData() (WrappedBlockData), getBlockPositionModifier() (BlockPosition),
        getBlockPositionCollectionModifier(), getSectionPositions(), getChunkCoordIntPairs(),
        getDataWatcherModifier() (WrappedDataWatcher),
        getWatchableCollectionModifier() (List<WrappedWatchableObject>)   // metadata, pre-1.19.3
        getDataValueCollectionModifier() (List<WrappedDataValue>)         // metadata, 1.19.3+
        getEntityTypeModifier(), getEffectTypes(), getSoundEffects(), getNewParticles(),
        getPlayerInfoDataLists() (List<PlayerInfoData>), getAttributeCollectionModifier(),
        getServerPings(), getMinecraftKeys(), getEnumEntityUseActions(), getMerchantRecipeLists(),
        getMovingBlockPositions(), getWorldKeys(), getDimensionTypes(), getIntLists(), getUUIDLists(),
        getNumberFormats(), getOptionalTeamParameters(), getCustomPacketPayloads(), getStatisticMaps(),
        getWorldTypeModifier(), getGameStateIDs(), getDimensions()
        Plus the escape hatches:
        getModifier()               // StructureModifier<Object> — every field, raw NMS values
        getStructures()             // StructureModifier<InternalStructure> — nested records (1.17+ packets nest a lot)
        getOptionalStructures()     // Optional-wrapped nested records
        getSpecificModifier(Class<T>) // ask for any type by class

        Also on PacketContainer: PacketType getType(); PacketContainer deepClone();
        Object getHandle() (the raw NMS packet); Object getEntityModifier(World)/getEntityModifier(PacketEvent)
        to read an entity field as a Bukkit Entity.

        {IMPORTANT} Field INDEXES are not stable across Minecraft versions — Mojang reorders and
        re-types packet fields constantly. Never assume; verify against the wiki (minecraft.wiki
        "Java Edition protocol") for the exact version, and prefer the semantic accessors
        (getBlockPositionModifier over three getIntegers) when the packet has one.

        ============================================================================
        PACKET TYPES
        ============================================================================
        PacketType.Play.Server.*   — server to client (the ones you usually fake)
        PacketType.Play.Client.*   — client to server
        PacketType.Login.*, PacketType.Status.*, PacketType.Handshake.*, PacketType.Configuration.*

        A sample of Play.Server: BUNDLE, SPAWN_ENTITY, ANIMATION, BLOCK_CHANGE, MULTI_BLOCK_CHANGE,
        BLOCK_BREAK_ANIMATION, BLOCK_ACTION, TILE_ENTITY_DATA, MAP_CHUNK, UNLOAD_CHUNK, EXPLOSION,
        ENTITY_METADATA, ENTITY_EQUIPMENT, ENTITY_TELEPORT, ENTITY_DESTROY, ENTITY_VELOCITY,
        REL_ENTITY_MOVE, ENTITY_HEAD_ROTATION, ENTITY_EFFECT, MOUNT, CAMERA, PLAYER_INFO,
        SCOREBOARD_OBJECTIVE, SCOREBOARD_SCORE, SCOREBOARD_TEAM, SCOREBOARD_DISPLAY_OBJECTIVE,
        WINDOW_ITEMS, SET_SLOT, OPEN_WINDOW, CLOSE_WINDOW, SET_COOLDOWN, CHAT, SYSTEM_CHAT,
        DISGUISED_CHAT, KICK_DISCONNECT, KEEP_ALIVE, GAME_STATE_CHANGE, WORLD_PARTICLES,
        NAMED_SOUND_EFFECT, SET_TITLE_TEXT, SET_SUBTITLE_TEXT, SET_ACTION_BAR_TEXT, BOSS,
        PLAYER_LIST_HEADER_FOOTER, SERVER_DIFFICULTY, HELD_ITEM_SLOT, UPDATE_HEALTH, EXPERIENCE.
        Common Play.Client: POSITION, POSITION_LOOK, LOOK, BLOCK_DIG, BLOCK_PLACE, USE_ENTITY,
        ARM_ANIMATION, CHAT, HELD_ITEM_SLOT, WINDOW_CLICK, CLIENT_COMMAND, SETTINGS, CUSTOM_PAYLOAD.

        Names drift between Minecraft versions — check PacketType in your ProtocolLib version if one
        does not resolve. PacketType.Play.Server.getInstance() enumerates them at runtime.

        ============================================================================
        WRAPPERS (com.comphenix.protocol.wrappers)
        ============================================================================
        WrappedChatComponent — chat/title/name JSON components
          static WrappedChatComponent fromText(String plain)
          static WrappedChatComponent fromJson(String json)
          static WrappedChatComponent fromLegacyText(String legacyColorCodes)
          String getJson(); void setJson(String)
        WrappedGameProfile — skins/NPC profiles
          WrappedGameProfile(UUID uuid, String name); UUID getUUID(); String getName();
          Multimap<String, WrappedSignedProperty> getProperties()
        WrappedSignedProperty(String name, String value, String signature)  // "textures"
        WrappedDataWatcher — entity metadata (pre-1.19.3 style)
          WrappedDataWatcher(); WrappedDataWatcher(Entity entity);
          void setObject(int index, WrappedDataWatcherObject object, Object value)
          Object getObject(int index); List<WrappedWatchableObject> getWatchableObjects()
          WrappedDataWatcher.Registry.get(Class<?>) for the serializer of a type
        WrappedDataValue(int index, Serializer serializer, Object value) — metadata on 1.19.3+
        WrappedBlockData — static WrappedBlockData createData(Material); createData(BlockData)
        BlockPosition(int x, int y, int z) — getX/getY/getZ; toVector(); static BlockPosition ORIGIN
        ChunkCoordIntPair(int x, int z)
        WrappedParticle — static WrappedParticle create(Particle, Object data)
        PlayerInfoData(UUID id, int latency, boolean listed, EnumWrappers.NativeGameMode mode,
                       WrappedGameProfile profile, WrappedChatComponent displayName)
        WrappedServerPing — MOTD/favicon on the status ping
        EnumWrappers — NativeGameMode, EntityUseAction, Hand, TitleAction, ChatType,
          PlayerInfoAction, PlayerDigType, ScoreboardAction, Difficulty, ClientCommand, ItemSlot, …
        MinecraftKey(String prefix, String key) — namespaced ids

        ============================================================================
        EXAMPLES
        ============================================================================
        --- 1. A fake block, only that player sees it ---
        \`\`\`java
        PacketContainer packet = protocol.createPacket(PacketType.Play.Server.BLOCK_CHANGE);
        packet.getBlockPositionModifier().write(0, new BlockPosition(x, y, z));
        packet.getBlockData().write(0, WrappedBlockData.createData(Material.DIAMOND_BLOCK));
        protocol.sendServerPacket(player, packet);
        // Undo it by sending the world's real block back:
        // packet.getBlockData().write(0, WrappedBlockData.createData(world.getBlockAt(x,y,z).getBlockData()));
        \`\`\`

        --- 2. Cancel/rewrite an outgoing chat packet ---
        \`\`\`java
        protocol.addPacketListener(new PacketAdapter(plugin, ListenerPriority.HIGH,
                PacketType.Play.Server.SYSTEM_CHAT) {
            @Override public void onPacketSending(PacketEvent event) {
                WrappedChatComponent component = event.getPacket().getChatComponents().read(0);
                if (component == null) return;
                String json = component.getJson();
                if (json.contains("secret")) { event.setCancelled(true); return; }
                component.setJson(json.replace("badword", "****"));
                event.getPacket().getChatComponents().write(0, component);
            }
        });
        \`\`\`

        --- 3. Read where the client is looking / clicking ---
        \`\`\`java
        protocol.addPacketListener(new PacketAdapter(plugin, PacketType.Play.Client.USE_ENTITY) {
            @Override public void onPacketReceiving(PacketEvent event) {
                int entityId = event.getPacket().getIntegers().read(0);
                EnumWrappers.EntityUseAction action =
                        event.getPacket().getEnumEntityUseActions().read(0).getAction();
                // This is a NETTY thread — hop to the main thread before touching Bukkit:
                Bukkit.getScheduler().runTask(plugin, () -> handleClick(event.getPlayer(), entityId, action));
            }
        });
        \`\`\`

        --- 4. Hide a player's held item from everyone else ---
        \`\`\`java
        protocol.addPacketListener(new PacketAdapter(plugin, PacketType.Play.Server.ENTITY_EQUIPMENT) {
            @Override public void onPacketSending(PacketEvent event) {
                int entityId = event.getPacket().getIntegers().read(0);
                Entity entity = protocol.getEntityFromID(event.getPlayer().getWorld(), entityId);
                if (entity instanceof Player target && shouldHide(target)) event.setCancelled(true);
            }
        });
        \`\`\`

        --- 5. Make an entity glow for ONE player (metadata override, 1.19.3+) ---
        \`\`\`java
        PacketContainer meta = protocol.createPacket(PacketType.Play.Server.ENTITY_METADATA);
        meta.getIntegers().write(0, target.getEntityId());
        byte flags = 0x40;                                        // 0x40 = glowing bit
        WrappedDataValue value = new WrappedDataValue(
                0, WrappedDataWatcher.Registry.get(Byte.class), flags);
        meta.getDataValueCollectionModifier().write(0, List.of(value));
        protocol.sendServerPacket(viewer, meta);
        \`\`\`

        --- 6. Clean up ---
        \`\`\`java
        @Override public void onDisable() {
            ProtocolLibrary.getProtocolManager().removePacketListeners(this);
        }
        \`\`\`

        ============================================================================
        THREADING — the thing people get wrong
        ============================================================================
        - onPacketSending / onPacketReceiving run on NETTY I/O THREADS, not the server main thread.
          Building and sending packets there is fine. Touching the Bukkit world, entities,
          inventories, or scheduler state is NOT — hop with Bukkit.getScheduler().runTask(...).
        - Keep listeners cheap. They run for every matching packet of every player; a slow listener
          on ENTITY_METADATA or MAP_CHUNK will tank the network threads long before it shows in TPS.
        - Only register the exact PacketTypes you need. Never register a wildcard listener "to see
          what happens" on a production server.
        - sendServerPacket(player, packet, false) skips other plugins' listeners — use it when you
          are re-sending a packet you already processed, to avoid recursion.
        - Async listeners: getAsynchronousManager().registerAsyncHandler(...) moves processing off
          the netty thread when you need to do something slow (a database lookup) before the packet
          continues. It delays the packet, so only use it when you truly must.

        ============================================================================
        PRACTICAL NOTES
        ============================================================================
        - ProtocolLib is version-sensitive by nature. Always guard with
          Bukkit.getPluginManager().isPluginEnabled("ProtocolLib") if it is a softdepend, and
          consider gating unusual packet work behind a config toggle so a Minecraft update cannot
          hard-break your plugin.
        - For fake ENTITIES specifically (holograms, NPCs, animated mobs), the packet sequence is
          SPAWN_ENTITY -> ENTITY_METADATA -> (movement packets) -> ENTITY_DESTROY, and you must
          allocate an unused entity id. This is fiddly and version-dependent; a purpose-built
          library is usually the better answer if one is available for the project.
        - The client trusts what you send. Sending a block/entity that does not exist server-side
          means the client desyncs until something re-sends the truth — always plan how the illusion
          gets cleaned up (chunk resend, ENTITY_DESTROY, real block packet).
    `
};
