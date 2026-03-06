import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";

const GradeStackBar = ({ data }) => {
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  const createStackBarOption = (sourceData) => {
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

    return {
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "shadow"
        },
        formatter(params) {
          const idx = params?.[0]?.dataIndex ?? 0;
          const name = labels[idx];
          const total = totalArr[idx] || 0;

          return `
            ${name}<br/>
            ${params.map((p) => `${p.marker}${p.seriesName}：${p.value}人`).join("<br/>")}<br/>
            总计：${total}人
          `;
        }
      },
      legend: {
        top: 0,
        data: ["R0 低", "R1 中", "R2 高", "R3 极高"],
        textStyle: {
          color: "#666"
        }
      },
      grid: {
        left: 70,
        right: 70,
        top: 50,
        bottom: 20
      },
      xAxis: {
        type: "value",
        min: 0,
        max: Math.ceil(maxTotal * 1.2),
        axisLine: {
          show: false
        },
        axisTick: {
          show: false
        },
        splitLine: {
          lineStyle: {
            color: "#f0f0f0"
          }
        },
        axisLabel: {
          color: "#999"
        }
      },
      yAxis: {
        type: "category",
        data: labels,
        axisLine: {
          show: false
        },
        axisTick: {
          show: false
        },
        axisLabel: {
          color: "#333"
        }
      },
      series: [
        {
          name: "R0 低",
          type: "bar",
          stack: "total",
          barWidth: 24,
          itemStyle: {
            color: "#52c41a",
            borderRadius: [4, 0, 0, 4]
          },
          data: r0Data
        },
        {
          name: "R1 中",
          type: "bar",
          stack: "total",
          barWidth: 24,
          itemStyle: {
            color: "#faad14"
          },
          data: r1Data
        },
        {
          name: "R2 高",
          type: "bar",
          stack: "total",
          barWidth: 24,
          itemStyle: {
            color: "#fa8c16"
          },
          data: r2Data
        },
        {
          name: "R3 极高",
          type: "bar",
          stack: "total",
          barWidth: 24,
          itemStyle: {
            color: "#f5222d",
            borderRadius: [0, 4, 4, 0]
          },
          data: r3Data,
          label: {
            show: true,
            position: "right",
            color: "#666",
            formatter: (params) => `${totalArr[params.dataIndex]}人`
          }
        }
      ]
    };
  };

  useEffect(() => {
    if (!chartRef.current || data.length === 0) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.dispose();
    }

    const chart = echarts.init(chartRef.current);
    chartInstanceRef.current = chart;

    const option = createStackBarOption(data);
    chart.setOption(option, true);

    return () => {
      chart.dispose();
      chartInstanceRef.current = null;
    };
  }, [data]);

  useEffect(() => {
    const handleResize = () => {
      chartInstanceRef.current?.resize();
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const chartHeight = Math.max(180, data.length * 60);

  return <div ref={chartRef} style={{ width: "100%", height: `${chartHeight}px` }} />;
};

export default GradeStackBar;
