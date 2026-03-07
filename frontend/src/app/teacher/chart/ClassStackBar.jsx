import React, { useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts";

const MOBILE_BREAKPOINT = 768;
const MOBILE_DEFAULT_COUNT = 8;

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

const ClassStackBar = ({ data = [] }) => {
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const isMobile = useIsMobile();
  const [expanded, setExpanded] = useState(false);

  const sortedData = useMemo(() => {
    const list = Array.isArray(data) ? [...data] : [];
    return list.sort((a, b) => (a?.class_no || 0) - (b?.class_no || 0));
  }, [data]);

  useEffect(() => {
    setExpanded(false);
  }, [data]);

  const visibleData = useMemo(() => {
    if (!isMobile) return sortedData;
    if (expanded) return sortedData;
    return sortedData.slice(0, MOBILE_DEFAULT_COUNT);
  }, [sortedData, isMobile, expanded]);

  const hasMore = isMobile && sortedData.length > MOBILE_DEFAULT_COUNT;
  const hasData = visibleData.length > 0;

  const chartHeight = useMemo(() => {
    const minHeight = isMobile ? 280 : 240;
    const rowHeight = isMobile ? 48 : 58;
    return Math.max(minHeight, visibleData.length * rowHeight);
  }, [visibleData.length, isMobile]);

  const option = useMemo(() => {
    const labels = visibleData.map((item) => `${item.class_no}班`);
    const r0Data = visibleData.map((item) => item?.risk_dist?.R0 || 0);
    const r1Data = visibleData.map((item) => item?.risk_dist?.R1 || 0);
    const r2Data = visibleData.map((item) => item?.risk_dist?.R2 || 0);
    const r3Data = visibleData.map((item) => item?.risk_dist?.R3 || 0);

    const totalArr = visibleData.map((item) => {
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
        left: isMobile ? 48 : 68,
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
        data: labels,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: "#333",
          fontSize: isMobile ? 11 : 12,
          width: isMobile ? 38 : 56,
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
  }, [visibleData, isMobile]);

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
      <div ref={chartRef} style={{ width: "100%", height: `${chartHeight}px` }} />
      {hasMore && (
        <div
          style={{
            marginTop: 8,
            textAlign: "center"
          }}
        >
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            style={{
              border: "none",
              background: "transparent",
              color: "#1890ff",
              fontSize: 13,
              cursor: "pointer",
              padding: "4px 8px"
            }}
          >
            {expanded ? "收起班级" : `展开全部班级（共 ${sortedData.length} 个）`}
          </button>
        </div>
      )}
    </div>
  );
};

export default ClassStackBar;
