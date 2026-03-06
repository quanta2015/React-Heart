import React, { useState, useEffect, useMemo } from "react";
import { Card, Row, Col, Progress, Table, Tag, Select, Space, Spin } from "antd";
import { get } from "@/util/request";
import * as urls from "@/constant/urls";
import s from "./index.module.less";
import GradeStackBar from "./chart/GradeStackBar";
import ClassStackBar from "./chart/ClassStackBar";
import RadarChart from "./chart/RadarChart";

const Teacher = () => {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [gradeStats, setGradeStats] = useState([]);
  const [classStats, setClassStats] = useState([]);
  const [students, setStudents] = useState([]);
  const [filters, setFilters] = useState({ grade: undefined, class_no: undefined });

  const fetchOverview = async () => {
    try {
      const params = {};
      if (filters.grade) params.grade = filters.grade;
      if (filters.class_no) params.class_no = filters.class_no;

      const res = await get(urls.API_TEACHER_STATS_OVERVIEW, params);
      if (res.code === 200) {
        setOverview(res.data);
      }
    } catch (err) {
      console.error("获取概览失败:", err);
    }
  };

  const fetchGradeStats = async () => {
    try {
      const res = await get(urls.API_TEACHER_STATS_BY_GRADE);
      if (res.code === 200) {
        setGradeStats(res.data || []);
      }
    } catch (err) {
      console.error("获取年级统计失败:", err);
    }
  };

  const fetchClassStats = async () => {
    try {
      const params = {};
      if (filters.grade) params.grade = filters.grade;

      const res = await get(urls.API_TEACHER_STATS_BY_CLASS, params);
      if (res.code === 200) {
        setClassStats(res.data || []);
      }
    } catch (err) {
      console.error("获取班级统计失败:", err);
    }
  };

  const fetchStudents = async () => {
    try {
      const params = {};
      if (filters.grade) params.grade = filters.grade;
      if (filters.class_no) params.class_no = filters.class_no;

      const res = await get(urls.API_TEACHER_STUDENTS, params);
      if (res.code === 200) {
        setStudents(res.data || []);
      }
    } catch (err) {
      console.error("获取学生列表失败:", err);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await Promise.all([fetchOverview(), fetchGradeStats(), fetchClassStats(), fetchStudents()]);
      setLoading(false);
    };

    fetchData();
  }, [filters]);

  // 动态生成年级下拉选项
  const gradeOptions = useMemo(() => {
    return [...new Set((gradeStats || []).map((item) => item?.grade).filter((v) => v !== undefined && v !== null))]
      .sort((a, b) => a - b)
      .map((grade) => ({
        label: `${grade} 年级`,
        value: grade
      }));
  }, [gradeStats]);

  // 动态生成班级下拉选项
  const classOptions = useMemo(() => {
    return [...new Set((classStats || []).map((item) => item?.class_no).filter((v) => v !== undefined && v !== null))]
      .sort((a, b) => a - b)
      .map((classNo) => ({
        label: `${classNo}班`,
        value: classNo
      }));
  }, [classStats]);

  const riskLevelColors = {
    R0: "#52c41a",
    R1: "#1890ff",
    R2: "#fa8c16",
    R3: "#f5222d"
  };

  const riskLevelLabels = {
    R0: "低风险",
    R1: "中低风险",
    R2: "中高风险",
    R3: "高风险"
  };

  const studentColumns = [
    {
      title: "姓名",
      dataIndex: "real_name",
      key: "real_name",
      sorter: (a, b) => a.real_name.localeCompare(b.real_name)
    },
    {
      title: "年级",
      dataIndex: "grade",
      key: "grade",
      width: 80,
      sorter: (a, b) => a.grade - b.grade
    },
    {
      title: "班级",
      dataIndex: "class_no",
      key: "class_no",
      width: 80,
      sorter: (a, b) => a.class_no - b.class_no
    },
    {
      title: "测评状态",
      dataIndex: "has_test",
      key: "has_test",
      width: 100,
      render: (has_test) => <Tag color={has_test ? "green" : "orange"}>{has_test ? "已完成" : "未完成"}</Tag>
    },
    {
      title: "风险等级",
      dataIndex: "risk_level",
      key: "risk_level",
      width: 100,
      render: (risk_level, record) =>
        record.has_test ? <Tag color={riskLevelColors[risk_level]}>{riskLevelLabels[risk_level]}</Tag> : <span>-</span>
    },
    {
      title: "测评时间",
      dataIndex: "finished_at",
      key: "finished_at",
      width: 180,
      render: (finished_at) => (finished_at ? new Date(finished_at).toLocaleString("zh-CN") : "-")
    }
  ];

  if (loading) {
    return (
      <div className={s.loading}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className={s.teacher}>
      <Card className={s.filters}>
        <Space>
          <span>筛选：</span>

          <Select
            style={{ width: 140 }}
            placeholder="年级"
            value={filters.grade}
            allowClear
            options={gradeOptions}
            onChange={(value) =>
              setFilters((prev) => ({
                ...prev,
                grade: value,
                class_no: undefined
              }))
            }
          />

          <Select
            style={{ width: 140 }}
            placeholder="班级"
            value={filters.class_no}
            allowClear
            options={classOptions}
            onChange={(value) =>
              setFilters((prev) => ({
                ...prev,
                class_no: value
              }))
            }
            disabled={!filters.grade || classOptions.length === 0}
          />
        </Space>
      </Card>

      {overview && (
        <Card className={s.overview}>
          <Row gutter={16} align="stretch">
            {/* 左侧：完成率 */}
            <Col span={6}>
              <div className={s.overviewLeft}>
                <div className={s.overviewTitle}>完成情况</div>

                <div className={s.completeCircle}>
                  <Progress
                    type="circle"
                    percent={parseFloat(overview.completion.rate) * 100}
                    strokeColor="#1890ff"
                    width={120}
                  />
                </div>

                <div className={s.completeStats}>
                  <div className={s.statItem}>
                    <div className={s.statValue}>{overview.completion.finished}</div>
                    <div className={s.statLabel}>已完成</div>
                  </div>

                  <div className={s.statDivider}></div>

                  <div className={s.statItem}>
                    <div className={s.statValue}>{overview.completion.total_students}</div>
                    <div className={s.statLabel}>总人数</div>
                  </div>
                </div>
              </div>
            </Col>

            {/* 中间：风险等级 */}
            <Col span={10}>
              <div className={s.overviewCenter}>
                <div className={s.overviewTitle}>风险等级分布</div>
                <Row gutter={[12, 12]}>
                  {["R0", "R1", "R2", "R3"].map((level) => (
                    <Col span={12} key={level}>
                      <div className={s.riskItem}>
                        <Tag color={riskLevelColors[level]} style={{ fontSize: 14, padding: "4px 12px" }}>
                          {riskLevelLabels[level]}
                        </Tag>
                        <div className={s.riskCount}>{overview.risk_dist?.[level] || 0}人</div>
                      </div>
                    </Col>
                  ))}
                </Row>
              </div>
            </Col>

            {/* 右侧：雷达图 */}
            <Col span={8}>
              <div className={s.overviewRight}>
                <div className={s.overviewTitle}>领域分布雷达图</div>
                <RadarChart domainAvg={overview.domain_avg} />
              </div>
            </Col>
          </Row>
        </Card>
      )}

      {gradeStats.length > 0 && (
        <Card title="各年级风险分布" className={s.gradeStats} bodyStyle={{ padding: "12px 16px" }}>
          <GradeStackBar data={gradeStats} />
        </Card>
      )}

      {classStats.length > 0 && (
        <Card title="各班级风险分布" className={s.classStats} bodyStyle={{ padding: "12px 16px" }}>
          <ClassStackBar data={classStats} />
        </Card>
      )}

      <Card title="学生列表" className={s.students}>
        <Table
          columns={studentColumns}
          dataSource={students}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          scroll={{ x: 800 }}
        />
      </Card>
    </div>
  );
};

export default Teacher;
