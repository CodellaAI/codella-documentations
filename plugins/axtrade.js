module.exports = {
    name: 'AxTrade',
    description: 'AxTrade by Artillex Studios is a player-to-player trading plugin with a side-by-side trade GUI for items and currencies. Its API is small but targeted: register your own currency so it becomes tradeable in the trade window, and listen to request/complete/abort events to log trades, block them, or hand out rewards.',
    pluginId: 'AxTrade',
    mavenIntegration: `
        <repositories>
            <repository>
                <id>artillex-studios</id>
                <url>https://repo.artillex-studios.com/releases/</url>
            </repository>
        </repositories>
        <dependencies>
            <dependency>
                <groupId>com.artillexstudios.axtrade</groupId>
                <artifactId>AxTrade</artifactId>
                <version>1.20.0</version>
                <scope>provided</scope>
            </dependency>
        </dependencies>
    `,
    usage: `
        /**
         * AxTrade — com.artillexstudios.axtrade.api
         *
         * Two things the API is for:
         *   1. Registering a CURRENCY HOOK so your plugin's economy can be traded in the GUI.
         *   2. Listening to the trade lifecycle events.
         *
         * There is no "start a trade programmatically" method — trades are player-initiated.
         */

        plugin.yml:
        \`\`\`
        name: MyPlugin
        version: 1.0
        main: com.example.MyPlugin
        api-version: '1.20'
        softdepend: [AxTrade]
        \`\`\`

        ============================================================================
        REGISTERING YOUR CURRENCY (the main use of this API)
        ============================================================================
        AxTradeAPI (com.artillexstudios.axtrade.api):
        static void registerCurrencyHook(Plugin plugin, CurrencyHook hook)

        CurrencyHook (com.artillexstudios.axtrade.hooks.currency):
        void setup()                                        // called once on registration
        String getName()                                    // the id used in AxTrade's config
        boolean worksOffline()                              // can balances be moved for offline players?
        boolean usesDouble()                                // false = whole numbers only
        boolean isPersistent()
        double getBalance(UUID playerId)
        CompletableFuture<Boolean> giveBalance(UUID playerId, double amount)
        CompletableFuture<Boolean> takeBalance(UUID playerId, double amount)
        default Map<String, Object> getSettings()

        \`\`\`java
        import com.artillexstudios.axtrade.api.AxTradeAPI;
        import com.artillexstudios.axtrade.hooks.currency.CurrencyHook;

        public class GemsHook implements CurrencyHook {

            @Override public void setup() { }
            @Override public String getName()      { return "gems"; }
            @Override public boolean worksOffline(){ return true; }
            @Override public boolean usesDouble()  { return false; }   // whole gems only
            @Override public boolean isPersistent(){ return true; }

            @Override public double getBalance(UUID playerId) {
                return MyEconomy.getGems(playerId);
            }

            @Override public CompletableFuture<Boolean> giveBalance(UUID playerId, double amount) {
                return CompletableFuture.supplyAsync(() -> { MyEconomy.addGems(playerId, (long) amount); return true; });
            }

            @Override public CompletableFuture<Boolean> takeBalance(UUID playerId, double amount) {
                return CompletableFuture.supplyAsync(() -> {
                    if (MyEconomy.getGems(playerId) < amount) return false;   // MUST fail if they can't pay
                    MyEconomy.removeGems(playerId, (long) amount);
                    return true;
                });
            }
        }

        // In onEnable, after checking AxTrade is present:
        if (Bukkit.getPluginManager().isPluginEnabled("AxTrade")) {
            AxTradeAPI.registerCurrencyHook(this, new GemsHook());
        }
        \`\`\`
        Then the server owner enables \`gems\` in AxTrade's config and it appears in the trade GUI.

        {IMPORTANT} takeBalance MUST return false when the player cannot afford the amount. AxTrade
        relies on that boolean to abort the trade — returning true unconditionally lets players
        trade currency they do not have.

        ============================================================================
        EVENTS (com.artillexstudios.axtrade.api.events)
        ============================================================================
        AxTradeRequestEvent (Cancellable)
          Player getSender(); Player getReceiver()
          Cancel to block a trade request outright (combat tag, jailed, wrong world…).

        AxTradeCompleteEvent (Cancellable)
          Trade getTrade()
          Fires as the trade finalises. Cancelling stops the exchange.

        AxTradeAbortEvent
          The trade was cancelled by a player or by a listener.

        Trade (com.artillexstudios.axtrade.trade):
          TradePlayer getPlayer1(); TradePlayer getPlayer2()
          Player getOtherPlayer(Player one)

        \`\`\`java
        @EventHandler
        public void onRequest(AxTradeRequestEvent event) {
            if (isInCombat(event.getSender())) {
                event.setCancelled(true);
                event.getSender().sendMessage("You can't trade while in combat.");
            }
        }

        @EventHandler
        public void onComplete(AxTradeCompleteEvent event) {
            Trade trade = event.getTrade();
            logTrade(trade.getPlayer1(), trade.getPlayer2());
        }
        \`\`\`

        ============================================================================
        PRACTICAL NOTES
        ============================================================================
        - Register the currency hook in onEnable and guard it with isPluginEnabled("AxTrade") — the
          hook classes only exist when AxTrade is installed.
        - give/takeBalance return CompletableFuture. If your economy is a plain in-memory map, return
          CompletableFuture.completedFuture(true/false); do not block inside the future on the main
          thread.
        - worksOffline() matters: if it is false, AxTrade will refuse to move that currency when one
          side logs out mid-trade.
        - The other Artillex plugins on a server (AxVaults, AxRewards, AxAFKZone, AxVouchers) do not
          expose a public API package — integrate with those through their commands, placeholders or
          config instead.
    `
};
