// import React from "react";
// import { Modal, Tag } from "antd";
// import s from "./index.module.less";

// const HelpModal = ({ open, onCancel }) => {
//   const scales = [
//     {
//       id: "GAD-7",
//       title: "广泛性焦虑量表",
//       en: "Generalized Anxiety Disorder 7-item Scale",
//       desc: "用于评估广泛性焦虑障碍的筛查工具，包含 7 个条目，评估过去两周内焦虑症状的频率。评分范围 0-21 分。",
//       levels: ["0-4 分：无明显焦虑", "5-9 分：轻度焦虑", "10-14 分：中度焦虑", "15-21 分：重度焦虑"]
//     },
//     {
//       id: "PHQ-9",
//       title: "患者健康问卷",
//       en: "Patient Health Questionnaire 9-item",
//       desc: "用于抑郁症筛查和严重程度评估的工具，包含 9 个条目，基于 DSM-IV 抑郁症诊断标准。评分范围 0-27 分。",
//       levels: [
//         "0-4 分：无明显抑郁",
//         "5-9 分：轻度抑郁",
//         "10-14 分：中度抑郁",
//         "15-19 分：中重度抑郁",
//         "20-27 分：重度抑郁"
//       ]
//     },
//     {
//       id: "PSS",
//       title: "知觉压力量表",
//       en: "Perceived Stress Scale",
//       desc: "用于评估个体感知到的压力水平，测量个体对生活情境的不可控性、不可预测性和超负荷感的感知程度。",
//       levels: ["0-13 分：低压力", "14-26 分：中等压力", "27-40 分：高压力"]
//     },
//     {
//       id: "RSES",
//       title: "罗森伯格自尊量表",
//       en: "Rosenberg Self-Esteem Scale",
//       desc: "用于测量个体整体自尊水平的经典量表，包含 10 个条目，评估个体对自我的积极或消极态度。",
//       levels: ["10-30 分：低自尊", "31-34 分：中等自尊", "35-40 分：高自尊"]
//     },
//     {
//       id: "UCLA",
//       title: "孤独量表",
//       en: "UCLA Loneliness Scale",
//       desc: "用于评估个体主观孤独感和社会隔离感的量表，测量个体的社会关系质量和满足程度。",
//       levels: ["20-34 分：低孤独感", "35-49 分：中等孤独感", "50-80 分：高孤独感"]
//     },
//     {
//       id: "IAT",
//       title: "网络成瘾测试",
//       en: "Internet Addiction Test",
//       desc: "用于评估网络使用行为和网络成瘾程度的量表，包含 20 个条目，评估网络使用对日常生活的影响。",
//       levels: ["20-49 分：正常网络使用", "50-79 分：轻度网络成瘾", "80-100 分：重度网络成瘾"]
//     }
//   ];

//   return (
//     <Modal
//       title={<div className={s.modalHeaderTitle}>心理咨询评估量表专业指南</div>}
//       open={open}
//       onCancel={onCancel}
//       footer={null}
//       width={1100}
//       centered
//       zIndex={2001}
//       className={s.helpModal}
//     >
//       <div className={s.helpContent}>
//         <div className={s.intro}>
//           <div className={s.introIcon}>💡</div>
//           <p>
//             本系统集成国际公认的六大权威心理评估工具，旨在通过科学的数据维度，为您提供多维度的心理健康洞察与专业评估参考。
//           </p>
//         </div>

//         <div className={s.scaleGrid}>
//           {scales.map((item) => (
//             <div key={item.id} className={s.scaleCard}>
//               <div className={s.cardHeader}>
//                 <span className={s.scaleBadge}>{item.id}</span>
//                 <h3>{item.title}</h3>
//               </div>
//               <div className={s.enName}>{item.en}</div>
//               <p className={s.description}>{item.desc}</p>
//               <div className={s.scoreBox}>
//                 <div className={s.scoreTitle}>评分参考标准：</div>
//                 <ul>
//                   {item.levels.map((level, i) => (
//                     <li key={i}>{level}</li>
//                   ))}
//                 </ul>
//               </div>
//             </div>
//           ))}
//         </div>

//         <div className={s.note}>
//           <span className={s.noteTag}>风险提示</span>
//           本评估结果仅基于量表常模产出，仅供自我了解与初步筛查参考，不可作为临床医疗诊断依据。如感不适，请务必咨询持有执业资格的心理咨询师或前往专科医院就诊。
//         </div>
//       </div>
//     </Modal>
//   );
// };

// export default HelpModal;

import React from "react";
import { Modal, Tag } from "antd";
import s from "./index.module.less";

const scaleList = [
  {
    code: "GAD-7",
    name: "广泛性焦虑量表",
    en: "Generalized Anxiety Disorder 7-item Scale",
    desc: "用于评估广泛性焦虑障碍的筛查工具，包含 7 个条目，评估过去两周内焦虑症状的频率。评分范围 0-21 分，分数越高表示焦虑程度越严重。",
    ranges: ["0-4 分：无明显焦虑", "5-9 分：轻度焦虑", "10-14 分：中度焦虑", "15-21 分：重度焦虑"]
  },
  {
    code: "PHQ-9",
    name: "患者健康问卷",
    en: "Patient Health Questionnaire 9-item",
    desc: "用于抑郁症筛查和严重程度评估的工具，包含 9 个条目，基于 DSM-IV 抑郁症诊断标准。评分范围 0-27 分，分数越高表示抑郁程度越严重。",
    ranges: [
      "0-4 分：无明显抑郁",
      "5-9 分：轻度抑郁",
      "10-14 分：中度抑郁",
      "15-19 分：中重度抑郁",
      "20-27 分：重度抑郁"
    ]
  },
  {
    code: "PSS",
    name: "知觉压力量表",
    en: "Perceived Stress Scale",
    desc: "用于评估个体感知到的压力水平，测量个体对生活情境的不可控性、不可预测性和超负荷感的感知程度。常用版本包含 10 个条目，评分范围 0-40 分。",
    ranges: ["0-13 分：低压力", "14-26 分：中等压力", "27-40 分：高压力"]
  },
  {
    code: "RSES",
    name: "罗森伯格自尊量表",
    en: "Rosenberg Self-Esteem Scale",
    desc: "用于测量个体整体自尊水平的经典量表，包含 10 个条目，评估个体对自我的积极或消极态度。评分范围 10-40 分，分数越高表示自尊水平越高。",
    ranges: ["10-30 分：低自尊", "31-34 分：中等自尊", "35-40 分：高自尊"]
  },
  {
    code: "UCLA",
    name: "孤独量表",
    en: "UCLA Loneliness Scale",
    desc: "用于评估个体主观孤独感和社会隔离感的量表，测量个体的社会关系质量和满足程度。常用简版包含 20 个条目，评分范围 20-80 分，分数越高表示孤独感越强。",
    ranges: ["20-34 分：低孤独感", "35-49 分：中等孤独感", "50-80 分：高孤独感"]
  },
  {
    code: "IAT",
    name: "网络成瘾测试",
    en: "Internet Addiction Test",
    desc: "用于评估网络使用行为和网络成瘾程度的量表，包含 20 个条目，评估网络使用对日常生活的影响。评分范围 20-100 分，分数越高表示网络成瘾倾向越严重。",
    ranges: ["20-49 分：正常网络使用", "50-79 分：轻度网络成瘾", "80-100 分：重度网络成瘾"]
  }
];

const HelpModal = ({ open, onCancel }) => {
  return (
    <Modal
      title={null}
      open={open}
      onCancel={onCancel}
      footer={null}
      width={1480}
      zIndex={1001}
      className={s.helpModal}
    >
      <div className={s.modalHeader}>
        <div className={s.headerBadge}>心理测评说明</div>
        <h2>心理咨询评估量表介绍</h2>
        <p>本系统采用多项国际通用心理测评量表，用于辅助了解学生当前心理状态与风险特征。</p>
      </div>

      <div className={s.helpContent}>
        <div className={s.introCard}>
          <div className={s.introTitle}>量表使用说明</div>
          <p>
            以下量表用于焦虑、抑郁、压力、自尊、孤独感和网络使用行为等维度的综合评估。评估结果用于学校心理健康教育与辅导参考，
            不能替代专业临床诊断。
          </p>
        </div>

        <div className={s.scaleGrid}>
          {scaleList.map((item) => (
            <section className={s.scaleItem} key={item.code}>
              <div className={s.scaleHead}>
                <div>
                  <div className={s.scaleTitleRow}>
                    <h3>
                      {item.code} {item.name}
                    </h3>
                    <Tag className={s.scaleTag} bordered={false}>
                      标准量表
                    </Tag>
                  </div>
                  <p className={s.scaleEn}>{item.en}</p>
                </div>
              </div>

              <div className={s.scaleBody}>
                <div className={s.block}>
                  <div className={s.blockTitle}>用途说明</div>
                  <p>{item.desc}</p>
                </div>

                <div className={s.block}>
                  <div className={s.blockTitle}>评分参考</div>
                  <ul className={s.rangeList}>
                    {item.ranges.map((range) => (
                      <li key={range}>{range}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          ))}
        </div>

        <div className={s.noteCard}>
          <div className={s.noteTitle}>注意事项</div>
          <p>
            本评估结果仅供心理健康筛查、教育管理和辅导参考，不能作为临床诊断依据。如学生持续出现明显情绪困扰、行为异常或社会功能受损，
            建议及时联系专业心理咨询师或医疗机构进一步评估。
          </p>
        </div>
      </div>
    </Modal>
  );
};

export default HelpModal;
