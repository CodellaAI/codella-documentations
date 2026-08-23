module.exports = {
    name: 'ServerVariables',
    description: 'ServerVariables by Ajneb97 stores named global and per-player variables (strings, numbers and lists) that persist across restarts and are readable everywhere through PlaceholderAPI. Its API lets a plugin read and write those variables directly and listen for changes — a ready-made persistent key/value store you do not have to build, and a bridge to every config-driven plugin on the server.',
    pluginId: 'ServerVariables',
    dependencies: `
        PlaceholderAPI (for the %servervariables_...% placeholders; not needed for the Java API)
    `,
    mavenIntegration: `
        <repositories>
            <repository>
                <id>jitpack</id>
                <url>https://jitpack.io/</url>
            </repository>
        </repositories>
        <dependencies>
            <!-- ServerVariables is not published to a public repo; add the plugin jar as a
                 system-scope dependency from your server's plugins folder, or use jitpack if the
                 author has published the source. -->
            <dependency>
                <groupId>com.github.Ajneb97</groupId>
                <artifactId>ServerVariables</artifactId>
                <version>3.0.1</version>
                <scope>provided</scope>
            </dependency>
        </dependencies>
    `,
    usage: `
        /**
         * ServerVariables — svar.ajneb97.api
         *
         * Two kinds of variable, both configured in the plugin's variables.yml:
         *   GLOBAL   — one value for the whole server (an event state, a jackpot total).
         *   PLAYER   — one value per player (a stat, a cooldown flag, a quest step).
         * Each can hold a STRING (numbers are strings that happen to parse) or be a LIST.
         *
         * Every API method is STATIC on ServerVariablesAPI. Methods come in overloads that take
         * either a player UUID, a player name, or neither (= a global variable).
         */

        plugin.yml:
        \`\`\`
        name: MyPlugin
        version: 1.0
        main: com.example.MyPlugin
        api-version: '1.20'
        softdepend: [ServerVariables]
        \`\`\`

        ============================================================================
        ServerVariablesAPI (svar.ajneb97.api) — all static
        ============================================================================
        --- Reading ---
        StringVariableResult getVariableValue(String variableName)                       // global
        StringVariableResult getVariableValue(String playerName, String variableName)    // per player
        StringVariableResult getVariableValue(UUID playerId, String variableName)
        String getVariableDisplay(String variableName)                                   // formatted for display
        String getVariableDisplay(String playerName, String variableName)

        --- Writing ---
        StringVariableResult setVariableValue(String variableName, String value)                    // global
        StringVariableResult setVariableValue(String playerName, String variableName, String value)
        StringVariableResult setVariableValue(UUID playerId, String variableName, String value)

        --- Lists ---
        StringVariableResult getListVariableValueAtIndex(String variableName, int index)
        StringVariableResult getListVariableValueAtIndex(String playerName, String variableName, int index)
        StringVariableResult getListVariableValueAtIndex(UUID playerId, String variableName, int index)
        String getListVariableDisplayAtIndex(String variableName, int index)
        String getListVariableDisplayAtIndex(String playerName, String variableName, int index)
        StringVariableResult setListVariableValueAtIndex(String variableName, int index, String value)
        StringVariableResult setListVariableValueAtIndex(String playerName, String variableName, int index, String value)
        StringVariableResult setListVariableValueAtIndex(UUID playerId, String variableName, int index, String value)
        int getListVariableLength(String variableName)
        int getListVariableLength(String playerName, String variableName)
        int getListVariableLength(UUID playerId, String variableName)

        --- Players / metadata ---
        ServerVariablesPlayer getPlayerByName(String name)
        ServerVariablesPlayer getPlayerByUUID(UUID uuid)
        String getStringVariableInitialValue(String variableName)   // the configured default

        StringVariableResult (svar.ajneb97.model):
        String getResultValue()      // the value, or the error text when the call failed
        int getIndex()
        boolean isError() / the inherited VariableResult carries success + an error message
        static StringVariableResult noErrors(String value); static StringVariableResult error(...)

        {IMPORTANT} Every call returns a RESULT object, not a bare value — check it before using
        getResultValue(), because an unknown variable name comes back as an error result rather than
        throwing or returning null.

        ============================================================================
        EXAMPLES
        ============================================================================
        --- Read a per-player variable ---
        \`\`\`java
        import svar.ajneb97.api.ServerVariablesAPI;
        import svar.ajneb97.model.StringVariableResult;

        StringVariableResult result = ServerVariablesAPI.getVariableValue(player.getUniqueId(), "kills");
        String raw = result.getResultValue();
        int kills = 0;
        try { kills = Integer.parseInt(raw); } catch (NumberFormatException ignored) {}
        \`\`\`

        --- Write one ---
        \`\`\`java
        ServerVariablesAPI.setVariableValue(player.getUniqueId(), "kills", String.valueOf(kills + 1));
        \`\`\`

        --- A global variable ---
        \`\`\`java
        StringVariableResult state = ServerVariablesAPI.getVariableValue("event_active");
        if ("true".equalsIgnoreCase(state.getResultValue())) startEventLogic();

        ServerVariablesAPI.setVariableValue("jackpot", String.valueOf(newTotal));
        \`\`\`

        --- Lists ---
        \`\`\`java
        int size = ServerVariablesAPI.getListVariableLength(player.getUniqueId(), "completed_quests");
        for (int i = 0; i < size; i++) {
            String quest = ServerVariablesAPI.getListVariableValueAtIndex(
                    player.getUniqueId(), "completed_quests", i).getResultValue();
        }
        ServerVariablesAPI.setListVariableValueAtIndex(player.getUniqueId(), "completed_quests", 0, "tutorial");
        \`\`\`

        ============================================================================
        EVENTS (svar.ajneb97.api)
        ============================================================================
        VariableChangeEvent (abstract, extends org.bukkit.event.Event)
          Player getPlayer()                 // null for a global variable change
          Variable getVariable()
          Object getNewValue(); Object getOldValue()
        StringVariableChangeEvent extends VariableChangeEvent  — a string/number variable changed
        ListVariableChangeEvent  extends VariableChangeEvent   — a list variable changed

        \`\`\`java
        @EventHandler
        public void onVariableChange(StringVariableChangeEvent event) {
            if (!event.getVariable().getName().equals("rank")) return;
            Player player = event.getPlayer();
            if (player != null) player.sendMessage("Your rank is now " + event.getNewValue());
        }
        \`\`\`
        The events fire for changes made by commands, by other plugins and by the API alike, so they
        are the right hook for "react whenever this value moves" without polling.

        ============================================================================
        PLACEHOLDERS
        ============================================================================
        With PlaceholderAPI installed, every variable is readable from any placeholder-aware plugin:
          %servervariables_<variable>%                    — the raw value
          %servervariables_display_<variable>%            — the formatted/display value
          %servervariables_list_<variable>_<index>%       — a list entry
          %servervariables_listlength_<variable>%         — a list's length
        That is the main reason to use this plugin as a store: your plugin writes through the API and
        every menu/hologram/scoreboard plugin on the server can read it with zero integration work.

        ============================================================================
        PRACTICAL NOTES
        ============================================================================
        - Variables must exist in the plugin's variables.yml before the API can read or write them.
          Writing to an undeclared name returns an error result; it does not create the variable.
        - Everything is stored as a STRING. Numeric variables are strings you parse — always guard
          with try/catch, because an admin can type anything into the config or a command.
        - The API is a convenience layer over a file/database-backed store. Do not call it in a
          per-tick or per-block loop; read once, cache in your own object, write back when it changes.
        - Values are persisted by ServerVariables itself, including for offline players — that is the
          selling point over a HashMap.
        - Keep the ServerVariables imports in a separate class if you softdepend, so your plugin still
          loads on servers without it, and gate every entry point with
          \`Bukkit.getPluginManager().isPluginEnabled("ServerVariables")\`.
    `
};
