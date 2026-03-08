import { API_SERVER } from "./apis";

// 认证相关 API
export const API_LOGIN = API_SERVER + "/api/auth/login";
export const API_AUTH_ME = API_SERVER + "/api/auth/me";
export const API_DEV_CREATE_USER = API_SERVER + "/api/auth/dev-create-user";

// 学生端 API
export const API_STUDENT_TEST_GENERATE = API_SERVER + "/api/student/test/generate";
export const API_STUDENT_TEST_CURRENT = API_SERVER + "/api/student/test/current";
export const API_STUDENT_TEST_SUBMIT = API_SERVER + "/api/student/test/submit";
export const API_STUDENT_RESULT = API_SERVER + "/api/student/result";

// 家长端 API
export const API_PARENT_TEST_GENERATE = API_SERVER + "/api/parent/test/generate";
export const API_PARENT_TEST_CURRENT = API_SERVER + "/api/parent/test/current";
export const API_PARENT_TEST_SUBMIT = API_SERVER + "/api/parent/test/submit";
export const API_PARENT_RESULT = API_SERVER + "/api/parent/result";

// 教师端 API
export const API_TEACHER_STATS_OVERVIEW = API_SERVER + "/api/teacher/stats/overview";
export const API_TEACHER_STATS_BY_GRADE = API_SERVER + "/api/teacher/stats/by-grade";
export const API_TEACHER_STATS_BY_CLASS = API_SERVER + "/api/teacher/stats/by-class";
export const API_TEACHER_STUDENTS = API_SERVER + "/api/teacher/students";
export const API_TEACHER_STUDENT_RESULT = API_SERVER + "/api/teacher/student";

// 教育局端 API
export const API_BUREAU_SCHOOLS = API_SERVER + "/api/bureau/schools";

// 其他 API
export const API_COLLEGE_LIST = API_SERVER + "/api/collegelist";
