import { useEffect, useMemo } from "react";
import { toTVSymbol } from "../data/api";

export default function TVChart({ ticker, exchange }) {
  const symbol      = useMemo(() => toTVSymbol(ticker, exchange), [ticker, exchange]);
  const containerId = useMemo(() => `tv_${ticker.replace(/[^A-Za-z0-9]/g, "_")}`, [ticker]);

  useEffect(() => {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";

    let mounted = true;

    const init = () => {
      if (!mounted || !container.isConnected) return;
      new window.TradingView.widget({
        container_id:       containerId,
        symbol,
        interval:           "D",
        timezone:           "exchange",
        theme:              "dark",
        style:              "1",
        width:              "100%",
        height:             420,
        withdateranges:     true,
        hide_volume:        false,
        locale:             "en",
        allow_symbol_change: false,
        hide_side_toolbar:  false,
        save_image:         false,
        toolbar_bg:         "#131722",
        enable_publishing:  false,
        studies:            [],
      });
    };

    if (window.TradingView) {
      init();
    } else {
      const script = document.createElement("script");
      script.src   = "https://s3.tradingview.com/tv.js";
      script.async = true;
      script.onload = init;
      document.head.appendChild(script);
    }

    return () => {
      mounted = false;
      if (container) container.innerHTML = "";
    };
  }, [containerId, symbol]);

  return (
    <div
      id={containerId}
      style={{
        height: 420,
        borderRadius: 10,
        overflow: "hidden",
        background: "#131722",
        minHeight: 300,
      }}
    />
  );
}
