import React, { useState, useEffect, useMemo, useRef } from "react";
import { Card, Row, Col, Progress, Table, Tag, Select, Spin, message, Empty, Modal, Button } from "antd";
import { get } from "@/util/request";
import * as urls from "@/constant/urls";
import s from "./index.module.less";
import GradeStackBar from "./chart/GradeStackBar";
import ClassStackBar from "./chart/ClassStackBar";
import RadarChart from "./chart/RadarChart";
import ResultsSection from "@/component/ResultsSection";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { generatePsychSuggestion } from "@/util/suggestionEngine";
import { exportTeacherStatisticReport } from "@/util/teacherReportPdf";

const Teacher = () => {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [gradeStats, setGradeStats] = useState([]);
  const [classStats, setClassStats] = useState([]);
  const [students, setStudents] = useState([]);
  const [filters, setFilters] = useState({ grade: undefined, class_no: undefined });
  const [riskLevelFilter, setRiskLevelFilter] = useState(null);

  const handleTableChange = (pagination, filters) => {
    if (filters.risk_level) {
      setRiskLevelFilter(filters.risk_level);
    } else {
      setRiskLevelFilter(null);
    }
  };

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentResult, setStudentResult] = useState(null);
  const [studentResultLoading, setStudentResultLoading] = useState(false);
  const [resultModalVisible, setResultModalVisible] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const reportRef = useRef(null);

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

  // 获取学生测试结果
  const fetchStudentResult = async (studentId) => {
    try {
      setStudentResultLoading(true);
      setStudentResult(null);

      const res = await get(`${urls.API_TEACHER_STUDENT_RESULT}/${studentId}/result`);
      if (res.code === 200 && res.data?.result) {
        setStudentResult(res.data.result);
      } else {
        setStudentResult(null);
        message.info("该学生暂无测评结果");
      }
    } catch (err) {
      console.error("获取学生结果失败:", err);
      setStudentResult(null);

      if (err.response?.status === 404) {
        message.info("该学生暂无测评结果");
      } else {
        message.error("获取测评结果失败");
      }
    } finally {
      setStudentResultLoading(false);
    }
  };

  // 处理表格行点击
  const handleRowClick = (record) => {
    if (!record.has_test) return;

    setSelectedStudent(record);
    setResultModalVisible(true);
    fetchStudentResult(record.id);
  };

  const handleCloseModal = () => {
    setResultModalVisible(false);
    setSelectedStudent(null);
    setStudentResult(null);
    setStudentResultLoading(false);
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await Promise.all([fetchOverview(), fetchGradeStats(), fetchClassStats(), fetchStudents()]);
      setLoading(false);
    };

    fetchData();
  }, [filters]);

  // 筛选变化后清空当前选中结果
  useEffect(() => {
    setSelectedStudent(null);
    setStudentResult(null);
    setStudentResultLoading(false);
    setResultModalVisible(false);
  }, [filters.grade, filters.class_no]);

  const gradeOptions = useMemo(() => {
    return [...new Set((gradeStats || []).map((item) => item?.grade).filter((v) => v !== undefined && v !== null))]
      .sort((a, b) => a - b)
      .map((grade) => ({
        label: `${grade} 年级`,
        value: grade
      }));
  }, [gradeStats]);

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
      width: 120,
      sorter: (a, b) => a.grade - b.grade
    },
    {
      title: "班级",
      dataIndex: "class_no",
      key: "class_no",
      width: 120,
      sorter: (a, b) => a.class_no - b.class_no
    },
    {
      title: "测评状态",
      dataIndex: "has_test",
      key: "has_test",
      width: 150,
      render: (has_test) => <Tag color={has_test ? "green" : "orange"}>{has_test ? "已完成" : "未完成"}</Tag>
    },
    {
      title: "风险等级",
      dataIndex: "risk_level",
      key: "risk_level",
      width: 150,
      filters: [
        { text: "低风险", value: "R0" },
        { text: "中低风险", value: "R1" },
        { text: "中高风险", value: "R2" },
        { text: "高风险", value: "R3" }
      ],
      onFilter: (value, record) => record.risk_level === value,
      filteredValue: riskLevelFilter,
      render: (risk_level, record) =>
        record.has_test ? <Tag color={riskLevelColors[risk_level]}>{riskLevelLabels[risk_level]}</Tag> : <span>-</span>
    },
    {
      title: "风险评分",
      dataIndex: "risk_score",
      key: "risk_score",
      width: 150,
      sorter: (a, b) => a.risk_score - b.risk_score,
      render: (risk_score, record) => (record.has_test ? risk_score : "-")
    },
    {
      title: "测评时间",
      dataIndex: "finished_at",
      key: "finished_at",
      width: 180,
      render: (finished_at) => (finished_at ? new Date(finished_at).toLocaleString("zh-CN") : "-")
    }
  ];

  const onRow = (record) => ({
    onClick: () => handleRowClick(record),
    style: {
      cursor: record.has_test ? "pointer" : "default",
      backgroundColor:
        selectedStudent?.id === record.id
          ? "rgba(19, 182, 236, 0.12)"
          : record.has_test
            ? "rgba(19, 182, 236, 0.02)"
            : "transparent"
    },
    onMouseEnter: (e) => {
      if (record.has_test && selectedStudent?.id !== record.id) {
        e.currentTarget.style.backgroundColor = "rgba(19, 182, 236, 0.08)";
      }
    },
    onMouseLeave: (e) => {
      e.currentTarget.style.backgroundColor =
        selectedStudent?.id === record.id
          ? "rgba(19, 182, 236, 0.12)"
          : record.has_test
            ? "rgba(19, 182, 236, 0.02)"
            : "transparent";
    }
  });

  const fetchStudentResultById = async (studentId) => {
    try {
      const res = await get(`${urls.API_TEACHER_STUDENT_RESULT}/${studentId}/result`);
      if (res.code === 200 && res.data?.result) {
        return res.data.result;
      }
      return null;
    } catch (err) {
      console.error(`获取学生 ${studentId} 结果失败:`, err);
      return null;
    }
  };

  // 并发控制，避免一次性打爆接口
  const batchFetchStudentResults = async (studentList, concurrency = 6) => {
    const testedStudents = (studentList || []).filter((item) => item.has_test);
    const resultMap = {};

    let currentIndex = 0;

    const worker = async () => {
      while (currentIndex < testedStudents.length) {
        const index = currentIndex;
        currentIndex += 1;

        const student = testedStudents[index];
        const result = await fetchStudentResultById(student.id);

        let suggestion = null;
        if (result) {
          try {
            suggestion = generatePsychSuggestion(result);
          } catch (error) {
            console.error(`生成学生 ${student.id} 建议失败:`, error);
            suggestion = null;
          }
        }

        resultMap[student.id] = {
          result,
          suggestion
        };
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, testedStudents.length || 1) }, () => worker());
    await Promise.all(workers);

    return resultMap;
  };

  const handleGenerateReport = async () => {
    try {
      setGeneratingReport(true);

      const schoolName = students?.[0]?.school_name || selectedStudent?.school_name || "学校";

      // 为避免导出时数据不全，这里重新拉一次全量数据（不带筛选）
      const [overviewRes, gradeRes, classRes, studentsRes] = await Promise.all([
        get(urls.API_TEACHER_STATS_OVERVIEW),
        get(urls.API_TEACHER_STATS_BY_GRADE),
        get(urls.API_TEACHER_STATS_BY_CLASS),
        get(urls.API_TEACHER_STUDENTS)
      ]);

      if (overviewRes?.code !== 200 || gradeRes?.code !== 200 || classRes?.code !== 200 || studentsRes?.code !== 200) {
        message.error("导出失败，统计数据获取不完整");
        return;
      }

      const exportOverview = overviewRes.data || {};
      const exportGradeStats = gradeRes.data || [];
      const exportClassStats = classRes.data || [];
      const exportStudents = studentsRes.data || [];

      if (!exportStudents.length) {
        message.warning("暂无可导出的学生数据");
        return;
      }

      message.loading({
        content: "正在整理学生测评结果，请稍候...",
        key: "teacher_report_export",
        duration: 0
      });

      const studentDetailMap = await batchFetchStudentResults(exportStudents, 6);

      const reportData = {
        schoolName,
        generatedAt: new Date().toISOString(),
        overview: exportOverview,
        gradeStats: exportGradeStats,
        classStats: exportClassStats,
        students: exportStudents,
        studentDetailMap
      };

      await exportTeacherStatisticReport(reportData);

      message.success({
        content: "报告生成完成",
        key: "teacher_report_export"
      });
    } catch (error) {
      console.error("生成教师端报告失败:", error);
      message.error({
        content: "生成报告失败，请稍后重试",
        key: "teacher_report_export"
      });
    } finally {
      setGeneratingReport(false);
    }
  };

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
        <div className={s.filterBar}>
          <span className={s.filterLabel}>筛选：</span>

          <Select
            className={s.filterSelect}
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
            className={s.filterSelect}
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
        </div>

        <Button type="primary" onClick={handleGenerateReport} loading={generatingReport} disabled={generatingReport}>
          生成报告
        </Button>
      </Card>

      {overview && (
        <Card className={s.overview}>
          <Row gutter={[16, 16]} align="stretch">
            <Col xs={24} sm={24} md={24} lg={6} xl={6}>
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

            <Col xs={24} sm={24} md={24} lg={10} xl={10}>
              <div className={s.overviewCenter}>
                <div className={s.overviewTitle}>风险等级分布</div>
                <Row gutter={[12, 12]}>
                  {["R0", "R1", "R2", "R3"].map((level) => (
                    <Col xs={12} sm={12} md={12} lg={12} xl={12} key={level}>
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

            <Col xs={24} sm={24} md={24} lg={8} xl={8}>
              <div className={s.overviewRight}>
                <div className={s.overviewTitle}>领域分布雷达图</div>
                <div className={s.radarWrap}>
                  <RadarChart domainAvg={overview.domain_avg} />
                </div>
              </div>
            </Col>
          </Row>
        </Card>
      )}

      {gradeStats.length > 0 && (
        <Card title="各年级风险分布" className={s.gradeStats} bodyStyle={{ padding: "12px 16px" }}>
          <div className={s.chartWrapGrade}>
            <GradeStackBar data={gradeStats} />
          </div>
        </Card>
      )}

      {classStats.length > 0 && (
        <Card title="各班级风险分布" className={s.classStats} bodyStyle={{ padding: "12px 16px" }}>
          <div className={s.chartWrapClass}>
            <ClassStackBar data={classStats} />
          </div>
        </Card>
      )}

      <Card title="学生列表" className={s.students}>
        <Table
          columns={studentColumns}
          dataSource={students}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          scroll={{ x: 800 }}
          onRow={onRow}
          onChange={handleTableChange}
        />
      </Card>

      <Modal
        open={resultModalVisible}
        onCancel={handleCloseModal}
        footer={null}
        width={960}
        destroyOnClose
        title={
          selectedStudent
            ? `测评结果：${selectedStudent.real_name}（${selectedStudent.grade}年级 ${selectedStudent.class_no}班）`
            : "测评结果"
        }
      >
        {studentResultLoading ? (
          <div className={s.resultLoading}>
            <Spin />
          </div>
        ) : studentResult ? (
          <ResultsSection result={studentResult} user={selectedStudent} />
        ) : (
          <Empty description="暂无测评结果" />
        )}
      </Modal>
    </div>
  );
};

export default Teacher;
