import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";

const RadarChart = ({ domainAvg }) => {
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  const createRadarOption = (domainAvgData = {}) => {
    const entries = Object.entries(domainAvgData || {});
    const indicators = entries.map(([name]) => ({
      name,
      max: 1
    }));
    const values = entries.map(([, value]) => Number(value || 0));

    return {
      tooltip: {
        trigger: "item",
        formatter() {
          return entries.map(([name, value]) => `${name}：${value}`).join("<br/>");
        }
      },
      legend: {
        show: false
      },
      radar: {
        center: ["50%", "55%"],
        radius: "62%",
        splitNumber: 5,
        indicator: indicators,
        axisName: {
          color: "#333",
          fontSize: 12
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
          name: "领域分布",
          type: "radar",
          data: [
            {
              value: values,
              name: "平均分布",
              areaStyle: {
                color: "rgba(24,144,255,0.25)"
              },
              lineStyle: {
                color: "#1890ff",
                width: 2
              },
              itemStyle: {
                color: "#1890ff"
              },
              symbol: "circle",
              symbolSize: 6
            }
          ]
        }
      ]
    };
  };

  useEffect(() => {
    if (!chartRef.current || !domainAvg) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.dispose();
    }

    const chart = echarts.init(chartRef.current);
    chartInstanceRef.current = chart;

    const option = createRadarOption(domainAvg);
    chart.setOption(option, true);

    return () => {
      chart.dispose();
      chartInstanceRef.current = null;
    };
  }, [domainAvg]);

  useEffect(() => {
    const handleResize = () => {
      chartInstanceRef.current?.resize();
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return <div ref={chartRef} style={{ width: "100%", height: 260 }} />;
};

export default RadarChart;
