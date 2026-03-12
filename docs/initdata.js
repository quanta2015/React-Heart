const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, 'output');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const DEFAULT_OPTIONS = [
  { text: '从不', value: 1 },
  { text: '较少', value: 2 },
  { text: '有时', value: 3 },
  { text: '经常', value: 4 },
  { text: '总是', value: 5 }
];

const SCALE_CONFIGS = [
  {
    type: 'TMH',
    scale_name: '教师心理健康量表',
    time_window: '最近两周',
    domain: '教师心理健康',
    facets: [
      '情绪低落',
      '焦虑紧张',
      '睡眠状态',
      '身心疲惫',
      '自我价值感',
      '无助感',
      '压力体验',
      '躯体反应',
      '恢复能力',
      '积极情绪'
    ]
  },
  {
    type: 'TST',
    scale_name: '教师职业压力量表',
    time_window: '最近一个月',
    domain: '教师职业压力',
    facets: [
      '教学任务压力',
      '班级管理压力',
      '考试升学压力',
      '行政事务压力',
      '绩效考核压力',
      '家校沟通压力',
      '角色冲突压力',
      '时间管理压力',
      '突发事件压力',
      '高负荷压力'
    ]
  },
  {
    type: 'TBO',
    scale_name: '教师职业倦怠量表',
    time_window: '最近一个月',
    domain: '教师职业倦怠',
    facets: [
      '情绪耗竭',
      '职业疏离',
      '成就感下降',
      '意义感减弱',
      '对学生失耐心',
      '对教学失兴趣',
      '机械化倾向',
      '消极应对',
      '离岗离职意向',
      '长期倦怠'
    ]
  },
  {
    type: 'TEM',
    scale_name: '教师情绪调节量表',
    time_window: '最近一个月',
    domain: '教师情绪调节',
    facets: [
      '情绪识别',
      '情绪表达',
      '冲突情绪控制',
      '压力下冷静',
      '负面情绪恢复',
      '自我安抚',
      '认知重评',
      '情绪稳定性',
      '面对学生管理',
      '面对家长管理'
    ]
  },
  {
    type: 'TSU',
    scale_name: '教师教育支持量表',
    time_window: '最近一个月',
    domain: '教师教育支持',
    facets: [
      '倾听支持',
      '鼓励反馈',
      '差异化支持',
      '尊重接纳',
      '安全感营造',
      '问题识别',
      '危机关注',
      '积极沟通',
      '成长反馈',
      '资源转介'
    ]
  },
  {
    type: 'TSC',
    scale_name: '学校组织氛围量表',
    time_window: '最近一个月',
    domain: '学校组织氛围',
    facets: [
      '组织支持感',
      '领导理解感',
      '同事合作',
      '制度公平感',
      '资源可得性',
      '培训支持感',
      '心理支持可及',
      '归属感',
      '安全感',
      '组织信任'
    ]
  },
  {
    type: 'TCL',
    scale_name: '课堂管理互动量表',
    time_window: '最近一个月',
    domain: '课堂管理互动',
    facets: [
      '课堂秩序维护',
      '学生参与促进',
      '问题行为应对',
      '学生情绪观察',
      '师生关系质量',
      '公平对待学生',
      '反馈及时性',
      '课堂压力感',
      '教学灵活性',
      '特殊学生支持'
    ]
  },
  {
    type: 'TWB',
    scale_name: '工作生活平衡量表',
    time_window: '最近一个月',
    domain: '工作生活平衡',
    facets: [
      '工作侵入生活',
      '休息恢复',
      '家庭时间保障',
      '边界管理',
      '下班后脱离',
      '假期恢复状态',
      '个人兴趣保留',
      '生活满意度',
      '长期节奏平衡',
      '精力分配感'
    ]
  },
  {
    type: 'TRE',
    scale_name: '教师人际关系量表',
    time_window: '最近一个月',
    domain: '教师人际关系',
    facets: [
      '同事关系',
      '领导关系',
      '家长关系',
      '学生关系',
      '沟通自信',
      '冲突处理',
      '合作意愿',
      '被理解感',
      '社交支持',
      '人际耗竭'
    ]
  },
  {
    type: 'TRF',
    scale_name: '风险识别转介量表',
    time_window: '最近一个月',
    domain: '风险识别转介',
    facets: [
      '学生风险识别',
      '自身风险识别',
      '求助意愿',
      '转介流程了解',
      '保密边界意识',
      '危机上报意识',
      '早期干预意识',
      '心理知识掌握',
      '资源使用能力',
      '协同支持意识'
    ]
  }
];

const positiveTemplates = [
  '面对{scene}时，我通常能够较好地应对。',
  '在{scene}中，我能保持比较稳定的状态。',
  '遇到与{scene}相关的情况时，我通常有办法处理。',
  '我认为自己在{scene}方面表现相对稳定。',
  '即使有压力，我在{scene}方面也能维持基本节奏。',
  '我在{scene}中能够及时觉察并调整自己。',
  '最近一个月，我在{scene}方面总体较为平稳。',
  '面对{scene}时，我通常不会轻易失控。',
  '我能以较积极的方式处理与{scene}有关的问题。',
  '在{scene}中，我通常具备一定掌控感。'
];

const negativeTemplates = [
  '最近一段时间，我常常因为{scene}感到吃力。',
  '一想到{scene}，我就容易感到明显压力。',
  '我经常在{scene}时感到疲惫或烦躁。',
  '面对{scene}时，我常有难以应对的感觉。',
  '最近我在{scene}方面经常感到无力。',
  '我常常因为{scene}而影响自己的情绪状态。',
  '在{scene}中，我容易陷入紧张、急躁或回避。',
  '我发现自己最近很难从{scene}带来的影响中恢复。',
  '与过去相比，我在{scene}方面更容易感到负担沉重。',
  '当涉及{scene}时，我常有被压得喘不过气的感觉。'
];

function buildFacetScenes(domain, facet) {
  const preset = {
    '情绪低落': ['日常教学', '备课工作', '重复事务', '处理学生问题', '工作结束后', '新的一周开始时', '学校要求较多时', '承担额外任务时', '连续忙碌后', '工作反馈不理想时'],
    '焦虑紧张': ['公开课准备', '考试周工作', '班级纪律波动时', '面对临时检查', '家长质疑时', '任务截止前', '会议汇报时', '被评价考核时', '突发状况出现时', '多任务并行时'],
    '睡眠状态': ['工作繁忙阶段', '备考监考期间', '连续加班之后', '处理班级事务后', '想到第二天工作时', '周中高压阶段', '学期关键节点', '承担额外职责时', '家校沟通频繁时', '情绪波动之后'],
    '身心疲惫': ['完成一整天教学后', '连续上课后', '应付多项任务时', '学期中段', '繁忙周期间', '集中批改作业时', '活动组织结束后', '长期高负荷状态下', '承担班主任工作时', '休息不足时']
  };
  if (preset[facet]) return preset[facet];
  return Array.from({ length: 10 }, (_, i) => `${domain}${facet}场景${i + 1}`);
}

function isPositiveFacet(facet) {
  const positiveFacets = new Set([
    '恢复能力',
    '积极情绪',
    '情绪识别',
    '情绪表达',
    '冲突情绪控制',
    '压力下冷静',
    '负面情绪恢复',
    '自我安抚',
    '认知重评',
    '情绪稳定性',
    '面对学生管理',
    '面对家长管理',
    '倾听支持',
    '鼓励反馈',
    '差异化支持',
    '尊重接纳',
    '安全感营造',
    '问题识别',
    '危机关注',
    '积极沟通',
    '成长反馈',
    '资源转介',
    '组织支持感',
    '领导理解感',
    '同事合作',
    '制度公平感',
    '资源可得性',
    '培训支持感',
    '心理支持可及',
    '归属感',
    '安全感',
    '组织信任',
    '课堂秩序维护',
    '学生参与促进',
    '问题行为应对',
    '学生情绪观察',
    '师生关系质量',
    '公平对待学生',
    '反馈及时性',
    '教学灵活性',
    '特殊学生支持',
    '休息恢复',
    '家庭时间保障',
    '边界管理',
    '下班后脱离',
    '假期恢复状态',
    '个人兴趣保留',
    '生活满意度',
    '长期节奏平衡',
    '精力分配感',
    '同事关系',
    '领导关系',
    '家长关系',
    '学生关系',
    '沟通自信',
    '冲突处理',
    '合作意愿',
    '被理解感',
    '社交支持',
    '学生风险识别',
    '自身风险识别',
    '求助意愿',
    '转介流程了解',
    '保密边界意识',
    '危机上报意识',
    '早期干预意识',
    '心理知识掌握',
    '资源使用能力',
    '协同支持意识'
  ]);
  return positiveFacets.has(facet);
}

function shouldReverse(facet, index) {
  if (isPositiveFacet(facet)) return index % 3 === 0;
  return index % 5 === 0;
}

function buildQuestion(facet, domain, index, reverseScored) {
  const scenes = buildFacetScenes(domain, facet);
  const scene = scenes[index % scenes.length];
  const templatePool = isPositiveFacet(facet)
    ? (reverseScored ? negativeTemplates : positiveTemplates)
    : (reverseScored ? positiveTemplates : negativeTemplates);
  const template = templatePool[index % templatePool.length];
  return template.replace('{scene}', scene);
}

function escapeSql(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}

function escapeCsv(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function generatePsychItems() {
  const items = [];

  for (const scale of SCALE_CONFIGS) {
    let serial = 1;

    for (const facet of scale.facets) {
      for (let i = 0; i < 10; i++) {
        const reverseScored = shouldReverse(facet, i);
        items.push({
          id: `${scale.type}${String(serial).padStart(3, '0')}`,
          type: scale.type,
          question: buildQuestion(facet, scale.domain, i, reverseScored),
          domain: scale.domain,
          facet,
          reverse_scored: reverseScored ? 1 : 0,
          options_json: DEFAULT_OPTIONS
        });
        serial += 1;
      }
    }
  }

  return items;
}

function generateScaleOptions() {
  return SCALE_CONFIGS.map((scale) => ({
    type: scale.type,
    scale_name: scale.scale_name,
    time_window: scale.time_window,
    min_score: 1,
    max_score: 5,
    options_json: DEFAULT_OPTIONS
  }));
}

function buildJson(items, scaleOptions) {
  return JSON.stringify(
    {
      psych_items: items,
      scale_options: scaleOptions
    },
    null,
    2
  );
}

function buildCsv(items) {
  const headers = [
    'id',
    'type',
    'question',
    'domain',
    'facet',
    'reverse_scored',
    'options_json'
  ];

  const rows = [headers.join(',')];

  for (const item of items) {
    rows.push([
      escapeCsv(item.id),
      escapeCsv(item.type),
      escapeCsv(item.question),
      escapeCsv(item.domain),
      escapeCsv(item.facet),
      escapeCsv(item.reverse_scored),
      escapeCsv(JSON.stringify(item.options_json))
    ].join(','));
  }

  return rows.join('\n');
}

function buildSql(items, scaleOptions) {
  const sql = [];

  sql.push('-- ========================================');
  sql.push('-- 教师题库 SQL（严格兼容现有数据库结构）');
  sql.push(`-- 总题数: ${items.length}`);
  sql.push('-- ========================================');
  sql.push('');

  sql.push('-- 1) 插入 scale_options');
  for (const row of scaleOptions) {
    sql.push(`
INSERT INTO scale_options (
  type,
  scale_name,
  time_window,
  min_score,
  max_score,
  options_json
) VALUES (
  ${escapeSql(row.type)},
  ${escapeSql(row.scale_name)},
  ${escapeSql(row.time_window)},
  ${row.min_score},
  ${row.max_score},
  ${escapeSql(JSON.stringify(row.options_json))}
)
ON DUPLICATE KEY UPDATE
  scale_name = VALUES(scale_name),
  time_window = VALUES(time_window),
  min_score = VALUES(min_score),
  max_score = VALUES(max_score),
  options_json = VALUES(options_json);
    `.trim());
  }

  sql.push('');
  sql.push('-- 2) 插入 psych_items');

  const batchSize = 100;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    sql.push(`
INSERT INTO psych_items (
  id,
  type,
  question,
  domain,
  facet,
  reverse_scored,
  options_json
) VALUES
${batch.map((item) => `(
  ${escapeSql(item.id)},
  ${escapeSql(item.type)},
  ${escapeSql(item.question)},
  ${escapeSql(item.domain)},
  ${escapeSql(item.facet)},
  ${item.reverse_scored},
  ${escapeSql(JSON.stringify(item.options_json))}
)`).join(',\n')}
ON DUPLICATE KEY UPDATE
  type = VALUES(type),
  question = VALUES(question),
  domain = VALUES(domain),
  facet = VALUES(facet),
  reverse_scored = VALUES(reverse_scored),
  options_json = VALUES(options_json);
    `.trim());
  }

  sql.push('');
  sql.push('SET FOREIGN_KEY_CHECKS = 1;');

  return sql.join('\n\n');
}

function main() {
  const items = generatePsychItems();
  const scaleOptions = generateScaleOptions();

  if (items.length !== 1000) {
    throw new Error(`题目数量错误，当前 ${items.length}，应为 1000`);
  }

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'teacher_bank_mysql_compatible.json'),
    buildJson(items, scaleOptions),
    'utf8'
  );

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'teacher_bank_mysql_compatible.csv'),
    buildCsv(items),
    'utf8'
  );

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'teacher_bank_mysql_compatible.sql'),
    buildSql(items, scaleOptions),
    'utf8'
  );

  console.log('生成完成：');
  console.log('- output/teacher_bank_mysql_compatible.json');
  console.log('- output/teacher_bank_mysql_compatible.csv');
  console.log('- output/teacher_bank_mysql_compatible.sql');
  console.log(`总题数：${items.length}`);
  console.log(`量表类型：${scaleOptions.length}`);
}

main();