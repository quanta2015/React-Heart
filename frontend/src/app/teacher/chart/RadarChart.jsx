import React, { useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts";

const MOBILE_BREAKPOINT = 768;

const useIsMobile = () => {
  const getValue = () => (typeof window !== "undefined" ? window.innerWidth < MOBILE_BREAKPOINT : false);

  const [isMobile, setIsMobile] = useState(getValue);

  useEffect(() => {
    const handleResize = () => setIsMobile(getValue());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return isMobile;
};

const shortName = (name, max = 4) => {
  if (!name) return "";
  return name.length > max ? `${name.slice(0, max)}…` : name;
};

const RadarChart = ({ domainAvg = {} }) => {
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const isMobile = useIsMobile();

  const entries = useMemo(() => {
    return Object.entries(domainAvg || {}).map(([name, value]) => ({
      name,
      value: Number(value || 0)
    }));
  }, [domainAvg]);

  const hasData = entries.length > 0;
  const chartHeight = isMobile ? 220 : 260;

  const option = useMemo(() => {
    const indicators = entries.map((item) => ({
      name: isMobile ? shortName(item.name, 4) : item.name,
      max: 1
    }));

    const values = entries.map((item) => item.value);

    return {
      animationDuration: 300,
      tooltip: {
        trigger: "item",
        confine: true,
        backgroundColor: "rgba(50,50,50,0.92)",
        borderWidth: 0,
        textStyle: {
          fontSize: isMobile ? 11 : 12
        },
        formatter() {
          return entries.map((item) => `${item.name}：${item.value.toFixed(2)}`).join("<br/>");
        }
      },
      radar: {
        center: ["50%", isMobile ? "52%" : "54%"],
        radius: isMobile ? "56%" : "64%",
        splitNumber: isMobile ? 4 : 5,
        indicator: indicators,
        axisName: {
          color: "#333",
          fontSize: isMobile ? 10 : 12,
          width: isMobile ? 56 : 80,
          overflow: "truncate"
        },
        splitLine: {
          lineStyle: {
            color: ["#f0f0f0"]
          }
        },
        splitArea: {
          areaStyle: {
            color: ["rgba(24,144,255,0.02)", "rgba(24,144,255,0.04)"]
          }
        },
        axisLine: {
          lineStyle: {
            color: "#d9d9d9"
          }
        }
      },
      series: [
        {
          type: "radar",
          data: [
            {
              value: values,
              name: "领域均值",
              areaStyle: {
                color: "rgba(24,144,255,0.22)"
              },
              lineStyle: {
                color: "#1890ff",
                width: isMobile ? 1.5 : 2
              },
              itemStyle: {
                color: "#1890ff"
              },
              symbol: "circle",
              symbolSize: isMobile ? 4 : 6
            }
          ]
        }
      ]
    };
  }, [entries, isMobile]);

  useEffect(() => {
    if (!chartRef.current) return;
    const chart = echarts.init(chartRef.current);
    chartInstanceRef.current = chart;

    const resizeObserver = new ResizeObserver(() => {
      chart.resize();
    });

    resizeObserver.observe(chartRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.dispose();
      chartInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!chartInstanceRef.current) return;

    if (!hasData) {
      chartInstanceRef.current.clear();
      chartInstanceRef.current.setOption({
        graphic: {
          type: "text",
          left: "center",
          top: "middle",
          style: {
            text: "暂无数据",
            fill: "#999",
            fontSize: 14
          }
        }
      });
      return;
    }

    chartInstanceRef.current.setOption(option, true);
    chartInstanceRef.current.resize();
  }, [option, hasData]);

  return (
    <div>
      <div ref={chartRef} style={{ width: "100%", height: chartHeight }} />

      {isMobile && hasData && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 8,
            marginTop: 10
          }}
        >
          {entries.map((item) => (
            <div
              key={item.name}
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                background: "#fafafa",
                border: "1px solid #f0f0f0"
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "#666",
                  lineHeight: 1.4,
                  marginBottom: 4
                }}
              >
                {item.name}
              </div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#1890ff",
                  lineHeight: 1.2
                }}
              >
                {item.value.toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RadarChart;
