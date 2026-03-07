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

const formatName = (name, max = 6) => {
  if (!name) return "";
  return name.length > max ? `${name.slice(0, max)}…` : name;
};

const GradeStackBar = ({ data = [] }) => {
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const isMobile = useIsMobile();

  const sourceData = useMemo(() => {
    if (!Array.isArray(data)) return [];
    return [...data].sort((a, b) => (a?.grade || 0) - (b?.grade || 0));
  }, [data]);

  const hasData = sourceData.length > 0;

  const chartHeight = useMemo(() => {
    const minHeight = isMobile ? 220 : 200;
    const rowHeight = isMobile ? 52 : 58;
    return Math.max(minHeight, sourceData.length * rowHeight);
  }, [sourceData.length, isMobile]);

  const option = useMemo(() => {
    const labels = sourceData.map((item) => `${item.grade}年级`);
    const r0Data = sourceData.map((item) => item?.risk_dist?.R0 || 0);
    const r1Data = sourceData.map((item) => item?.risk_dist?.R1 || 0);
    const r2Data = sourceData.map((item) => item?.risk_dist?.R2 || 0);
    const r3Data = sourceData.map((item) => item?.risk_dist?.R3 || 0);

    const totalArr = sourceData.map((item) => {
      const dist = item?.risk_dist || {};
      return (dist.R0 || 0) + (dist.R1 || 0) + (dist.R2 || 0) + (dist.R3 || 0);
    });

    const maxTotal = Math.max(...totalArr, 0);
    const xMax = Math.max(10, Math.ceil(maxTotal * 1.2));

    return {
      animationDuration: 300,
      color: ["#52c41a", "#1890ff", "#fa8c16", "#f5222d"],
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        confine: true,
        backgroundColor: "rgba(50,50,50,0.92)",
        borderWidth: 0,
        textStyle: {
          color: "#fff",
          fontSize: isMobile ? 11 : 12
        },
        formatter(params) {
          const idx = params?.[0]?.dataIndex ?? 0;
          const name = labels[idx];
          const total = totalArr[idx] || 0;
          return [`${name}`, ...params.map((p) => `${p.marker}${p.seriesName}：${p.value}人`), `总计：${total}人`].join(
            "<br/>"
          );
        }
      },
      legend: {
        top: 0,
        left: 0,
        itemWidth: isMobile ? 10 : 14,
        itemHeight: isMobile ? 10 : 14,
        icon: "roundRect",
        itemGap: isMobile ? 10 : 16,
        textStyle: {
          color: "#666",
          fontSize: isMobile ? 11 : 12
        },
        data: ["低风险", "中低风险", "中高风险", "高风险"]
      },
      grid: {
        left: isMobile ? 54 : 72,
        right: isMobile ? 56 : 74,
        top: isMobile ? 36 : 48,
        bottom: 8
      },
      xAxis: {
        type: "value",
        min: 0,
        max: xMax,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: {
          lineStyle: { color: "#f0f0f0" }
        },
        axisLabel: {
          color: "#999",
          fontSize: isMobile ? 10 : 12
        }
      },
      yAxis: {
        type: "category",
        data: labels.map((item) => (isMobile ? formatName(item, 4) : item)),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: "#333",
          fontSize: isMobile ? 11 : 12,
          width: isMobile ? 42 : 60,
          overflow: "truncate"
        }
      },
      series: [
        {
          name: "低风险",
          type: "bar",
          stack: "total",
          barWidth: isMobile ? 18 : 24,
          data: r0Data,
          itemStyle: {
            borderRadius: [4, 0, 0, 4]
          }
        },
        {
          name: "中低风险",
          type: "bar",
          stack: "total",
          barWidth: isMobile ? 18 : 24,
          data: r1Data
        },
        {
          name: "中高风险",
          type: "bar",
          stack: "total",
          barWidth: isMobile ? 18 : 24,
          data: r2Data
        },
        {
          name: "高风险",
          type: "bar",
          stack: "total",
          barWidth: isMobile ? 18 : 24,
          data: r3Data,
          itemStyle: {
            borderRadius: [0, 4, 4, 0]
          },
          label: {
            show: true,
            position: "right",
            distance: isMobile ? 4 : 8,
            color: "#666",
            fontSize: isMobile ? 10 : 12,
            formatter: (params) => `${totalArr[params.dataIndex]}`
          }
        }
      ]
    };
  }, [sourceData, isMobile]);

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

  return <div ref={chartRef} style={{ width: "100%", height: `${chartHeight}px` }} />;
};

export default GradeStackBar;
