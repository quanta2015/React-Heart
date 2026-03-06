import React, { useState, useEffect } from "react";
import { Card, Row, Col, Statistic, Progress, Table, Tag, Select, Space, Spin, message } from "antd";
import { get } from "@/util/request";
import * as urls from "@/constant/urls";
import s from "./index.module.less";

const { Option } = Select;

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
        setGradeStats(res.data);
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
        setClassStats(res.data);
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
        setStudents(res.data);
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
      {/* 筛选器 */}
      <Card className={s.filters}>
        <Space>
          <span>筛选：</span>
          <Select
            style={{ width: 120 }}
            placeholder="年级"
            onChange={(value) => setFilters({ ...filters, grade: value, class_no: undefined })}
            value={filters.grade}
            allowClear
          >
            <Option value={7}>7 年级</Option>
            <Option value={8}>8 年级</Option>
            <Option value={9}>9 年级</Option>
          </Select>
          <Select
            style={{ width: 120 }}
            placeholder="班级"
            onChange={(value) => setFilters({ ...filters, class_no: value })}
            value={filters.class_no}
            allowClear
            disabled={!filters.grade}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <Option key={n} value={n}>
                {n}班
              </Option>
            ))}
          </Select>
        </Space>
      </Card>

      {/* 概览统计 */}
      {overview && (
        <Row gutter={16} className={s.overview}>
          <Col span={6}>
            <Card>
              <Statistic
                title="完成率"
                value={parseFloat(overview.completion.rate) * 100}
                suffix="%"
                valueStyle={{ color: "#1890ff" }}
              />
              <Progress
                percent={parseFloat(overview.completion.rate) * 100}
                strokeColor={{ "0%": "#108ee9", "100%": "#87d068" }}
                showInfo={false}
                style={{ marginTop: 8 }}
              />
              <div className={s.subtext}>
                已完成 {overview.completion.finished} / 总计 {overview.completion.total_students}
              </div>
            </Card>
          </Col>
          <Col span={18}>
            <Card title="风险等级分布">
              <Row gutter={16}>
                {["R0", "R1", "R2", "R3"].map((level) => (
                  <Col span={6} key={level}>
                    <div className={s.riskItem}>
                      <Tag color={riskLevelColors[level]} style={{ fontSize: 14, padding: "4px 12px" }}>
                        {riskLevelLabels[level]}
                      </Tag>
                      <div className={s.riskCount}>{overview.risk_dist[level] || 0}人</div>
                    </div>
                  </Col>
                ))}
              </Row>
            </Card>
          </Col>
        </Row>
      )}

      {/* 领域平均分 */}
      {overview && overview.domain_avg && (
        <Card title="各领域平均分" className={s.domains}>
          <Row gutter={16}>
            {Object.entries(overview.domain_avg).map(([domain, score]) => (
              <Col span={4} key={domain}>
                <div className={s.domainItem}>
                  <div className={s.domainName}>{domain}</div>
                  <Progress
                    type="dashboard"
                    percent={parseFloat(score) * 20}
                    strokeColor={parseFloat(score) > 0.6 ? "#f5222d" : parseFloat(score) > 0.4 ? "#fa8c16" : "#52c41a"}
                    format={() => score}
                  />
                </div>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      {/* 年级统计 */}
      {gradeStats.length > 0 && (
        <Card title="按年级统计" className={s.gradeStats}>
          <Row gutter={16}>
            {gradeStats.map((item) => (
              <Col span={8} key={item.grade}>
                <Card size="small" title={`${item.grade}年级`}>
                  <div className={s.statRow}>
                    <span>完成率：</span>
                    <Progress
                      percent={parseFloat(item.completion_rate) * 100}
                      showInfo={false}
                      strokeColor={{ "0%": "#108ee9", "100%": "#87d068" }}
                    />
                    <span>{(parseFloat(item.completion_rate) * 100).toFixed(1)}%</span>
                  </div>
                  <div className={s.riskDist}>
                    {["R0", "R1", "R2", "R3"].map((level) => (
                      <Tag key={level} color={riskLevelColors[level]}>
                        {level}: {item.risk_dist[level]}
                      </Tag>
                    ))}
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      {/* 班级统计 */}
      {classStats.length > 0 && (
        <Card title="按班级统计" className={s.classStats}>
          <Row gutter={16}>
            {classStats.map((item) => (
              <Col span={6} key={item.class_no}>
                <Card size="small" title={`${item.class_no}班`}>
                  <div className={s.statRow}>
                    <span>完成率：</span>
                    <span style={{ fontWeight: "bold" }}>{(parseFloat(item.completion_rate) * 100).toFixed(1)}%</span>
                  </div>
                  <div className={s.riskDist}>
                    {["R0", "R1", "R2", "R3"].map((level) => (
                      <Tag key={level} color={riskLevelColors[level]}>
                        {level}: {item.risk_dist[level]}
                      </Tag>
                    ))}
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      {/* 学生列表 */}
      <Card title="学生列表" className={s.students}>
        <Table
          columns={studentColumns}
          dataSource={students}
          rowKey="id"
          pagination={{ pageSize: 20 }}
          scroll={{ x: 800 }}
        />
      </Card>
    </div>
  );
};

export default Teacher;
