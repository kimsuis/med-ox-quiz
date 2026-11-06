/* 내분비학 · 배재호 교수님 (2026-11-05 7~9교시)
   범위: 일정 폴더(261106v2 진도판 4/4)의 '강조점' 메모
     1번ppt 8p(인슐린 7step) · 10p(인슐린 분비조절인자) · 14p(GLUT4와 SGLT2)
     2번ppt 4p(GLP-1)
     3번ppt 5p(포도당 항상성 5단계) · 23p(AMPK) · 28p(식욕 억제/촉진 호르몬 + Adiponectin)
   문항 근거: 해당 강의록 쪽 + 올해 정리족(대사통합)·출족 중 그 쪽에 해당하는 내용만 */
QUIZ.register({
  id: "endo26-bae",
  subject: "내분비학",
  term: "본1-2 · 2026",
  professor: "배재호",
  title: "췌장호르몬 · 대사통합",
  date: "2026-11-05",
  slot: "7~9교시",
  examInfo: "전체 객관식 6문제 · R형 없음 · 시수·파트별 고정 배분 아님 · 강조 안 한 데서 1문제 정도",
  lectures: {
    P1: "1번 ppt · 췌장호르몬1",
    P2: "2번 ppt · 췌장호르몬2",
    P3: "3번 ppt · 대사통합"
  },
  focus: [
    { lec: "P1", page: 8, label: "인슐린 분비 7 step" },
    { lec: "P1", page: 10, label: "인슐린 분비 조절 인자" },
    { lec: "P1", page: 14, label: "GLUT4와 SGLT2" },
    { lec: "P2", page: 4, label: "GLP-1은 인슐린 분비 자극 인자에 의해 자극받음" },
    { lec: "P3", page: 5, label: "포도당 항상성 5단계 표" },
    { lec: "P3", page: 23, label: "AMPK — 에너지 결핍 센서, 기능, 활성화 시 혈당↓" },
    { lec: "P3", page: 28, label: "식욕 억제/촉진 호르몬 (+Adiponectin 추가)" }
  ],
  topics: [
    {
      id: "sec", name: "인슐린 분비 7 step", src: "P1 8p",
      summary: [
        "① GLUT2로 포도당 유입 → ② glucokinase 인산화(포도당 센서)",
        "③ ATP/ADP 비율↑ → ④ ATP-sensitive K⁺ 채널 닫힘",
        "⑤ β세포막 탈분극 → ⑥ voltage-gated Ca²⁺ 채널 열림, 세포 내 Ca²⁺↑",
        "⑦ 인슐린 과립 exocytosis",
        "Sulfonylurea = K_ATP 채널(SUR subunit)을 닫아서 분비 촉진"
      ]
    },
    {
      id: "reg", name: "인슐린 분비 조절 인자", src: "P1 10p",
      summary: [
        "촉진: 포도당·FFA·아미노산↑ / GLP-1·GIP·CCK·gastrin·secretin / 부교감(ACh)·β-adrenergic / sulfonylurea",
        "억제: 저혈당 / 금식·격렬한 운동 / somatostatin·α-adrenergic / leptin",
        "β는 촉진, α는 억제 — 헷갈리기 쉬움"
      ]
    },
    {
      id: "glut", name: "GLUT · SGLT", src: "P1 14p",
      summary: [
        "GLUT1: 뇌·RBC·태반·신장, basal uptake, 인슐린 비의존",
        "GLUT2: 간·β세포·소장·신장, 양방향 저친화성, 센서, 인슐린 비의존",
        "GLUT4: 골격근·심근·지방, 자극 시 세포막으로 이동, ★인슐린 의존",
        "SGLT1: 소장·신장 능동수송 (ORS 원리) / SGLT2: 근위세뇨관, 여과 포도당 80–90% 재흡수",
        "SGLT2 억제제: glycosuria, A1C↓, 저혈당 위험 낮음, 체중·혈압↓"
      ]
    },
    {
      id: "glp", name: "GLP-1", src: "P2 4p",
      summary: [
        "회장·대장 L세포에서 생성, glucagon과 같은 전구체(preproglucagon)의 다른 절단",
        "가장 강력한 내인성 인슐린 분비 촉진제",
        "분비 자극: 경구 포도당·갈락토스·아미노산, 콜린성, β-adrenergic = 인슐린 분비 자극 인자와 겹침",
        "Incretin effect: 경구 포도당이 IV보다 인슐린↑ (GLP-1·GIP 매개)"
      ]
    },
    {
      id: "phase", name: "포도당 항상성 5단계", src: "P3 5p",
      summary: [
        "I 외인성 → 모든 조직, 뇌 포도당",
        "II 글리코겐·간 당신생 → 간 제외 모든 조직(근육·지방 소비↓), 뇌 포도당",
        "III 간 당신생·글리코겐 → 간 제외 모든 조직, 뇌 포도당",
        "IV 당신생(간+신장) → 뇌·RBC·신장수질(근육 소량), 뇌 포도당+케톤체",
        "V 당신생(간+신장) → 뇌(소비↓)·RBC·신장수질, 뇌 케톤체 > 포도당"
      ]
    },
    {
      id: "ampk", name: "AMPK", src: "P3 23p",
      summary: [
        "AMP/ATP↑(운동·저산소·기아) 때 켜지는 에너지 결핍 센서",
        "ATP 생성 촉진: glycolysis, fatty acid oxidation↑",
        "ATP 소비 억제: 당신생, 단백질 합성, 지방산·콜레스테롤 합성↓",
        "→ AMPK 활성화하면 혈당을 낮출 수 있다 (metformin, 운동, adiponectin)"
      ]
    },
    {
      id: "app", name: "식욕 조절 호르몬", src: "P3 28p",
      summary: [
        "억제(anorexigenic): leptin, insulin, PYY3-36, GLP-1 (+CCK, secretin) → α-MSH↑, NPY↓ “eat less, metabolize more”",
        "촉진(orexigenic): ghrelin(위), ★adiponectin(지방) → NPY 세포 활성 “eat more, metabolize less”",
        "중추 분비: 촉진 NPY·AgRP / 억제 α-MSH·CART",
        "Adiponectin: 비만일수록↓, AMPK 활성, 인슐린 감수성↑, TZD가 분비↑"
      ]
    }
  ],
  questions: [
    // ── 인슐린 분비 7 step (P1 8p)
    { id: "sec1", t: "sec", a: true, q: "포도당은 β세포 안으로 GLUT2를 통해 들어간다.", why: "7 step의 1단계. β세포의 포도당 수송체는 GLUT2(인슐린 비의존)." },
    { id: "sec2", t: "sec", a: false, q: "β세포에서 포도당 센서 역할을 하는 효소는 hexokinase이다.", why: "센서는 glucokinase(2단계). Km이 높아 혈당 농도에 비례해 인산화한다." },
    { id: "sec3", t: "sec", a: false, q: "세포 내 ATP/ADP 비율이 올라가면 ATP-sensitive K⁺ 채널이 열린다.", why: "ATP가 붙으면 K_ATP 채널이 닫힌다(4단계). 닫혀야 K⁺가 못 나가서 탈분극된다." },
    { id: "sec4", t: "sec", a: false, q: "ATP-sensitive K⁺ 채널이 닫히면 β세포막은 과분극된다.", why: "K⁺ 유출이 막혀 세포 내 K⁺↑ → 탈분극(depolarization)." },
    { id: "sec5", t: "sec", a: true, q: "β세포막이 탈분극되면 voltage-gated Ca²⁺ 채널이 열려 세포 내 Ca²⁺가 증가하고, 이것이 인슐린 과립의 exocytosis를 일으킨다.", why: "5→6→7단계." },
    { id: "sec6", t: "sec", a: true, q: "순서: GLUT2 유입 → glucokinase 인산화 → ATP/ADP↑ → K_ATP 채널 닫힘 → 탈분극 → Ca²⁺ 채널 열림 → exocytosis", why: "강의록 8p의 Secretion 7 Steps 그대로." },
    { id: "sec7", t: "sec", a: false, q: "7 step에서 Ca²⁺ 유입은 K⁺ 채널이 닫히기 전에 일어난다.", why: "K⁺ 채널 닫힘(4) → 탈분극(5) → Ca²⁺ 채널 열림(6). Ca²⁺가 나중." },
    { id: "sec8", t: "sec", a: false, q: "Sulfonylurea는 voltage-gated Ca²⁺ 채널을 직접 열어 인슐린 분비를 촉진한다.", why: "SUR subunit에 붙어 ATP-sensitive K⁺ 채널을 닫는다 → 이후는 생리적 경로와 같음.", ex: "2018" },
    { id: "sec9", t: "sec", a: true, q: "포도당 주입 직후 인슐린이 급격히 오르는 시점에서 β세포 안에서는 K⁺ 농도가 증가(유출 감소)한다.", why: "K_ATP 채널이 닫혀 K⁺가 세포 안에 남고 → 탈분극 → Ca²⁺ 유입 → 분비.", ex: "2016" },

    // ── 인슐린 분비 조절 인자 (P1 10p)
    { id: "reg1", t: "reg", a: true, q: "혈중 포도당뿐 아니라 유리지방산(FFA)과 아미노산의 상승도 인슐린 분비를 촉진한다.", why: "영양소 촉진인자 = 포도당·FFA·아미노산." },
    { id: "reg2", t: "reg", a: false, q: "GLP-1, GIP, CCK, gastrin, secretin 같은 위장관 호르몬은 인슐린 분비를 억제한다.", why: "모두 분비 촉진인자(위장관 호르몬)." },
    { id: "reg3", t: "reg", a: true, q: "부교감신경(ACh, vagal 자극)은 인슐린 분비를 촉진한다.", why: "자율신경 촉진인자: 부교감(ACh), β-adrenergic.", ex: "2020" },
    { id: "reg4", t: "reg", a: false, q: "β-adrenergic 자극은 인슐린 분비를 억제한다.", why: "β-adrenergic은 촉진, α-adrenergic이 억제. β/α를 바꿔 내기 좋다." },
    { id: "reg5", t: "reg", a: true, q: "α-adrenergic 자극은 인슐린 분비를 억제한다.", why: "억제인자: somatostatin, α-adrenergic stimulation." },
    { id: "reg6", t: "reg", a: true, q: "Somatostatin은 인슐린 분비를 억제한다.", why: "δ세포의 somatostatin은 인슐린·글루카곤 둘 다 억제." },
    { id: "reg7", t: "reg", a: false, q: "지방세포에서 나오는 leptin은 인슐린 분비를 촉진한다.", why: "Leptin은 억제인자(지방세포 신호)." },
    { id: "reg8", t: "reg", a: true, q: "금식과 격렬한 운동은 인슐린 분비를 억제하는 생리적 상태이다.", why: "억제인자 – 생리적 상태: fasting, exercise." },
    { id: "reg9", t: "reg", a: false, q: "저혈당 상태는 인슐린 분비를 촉진한다.", why: "혈당 감소(decreased blood glucose)는 억제인자." },
    { id: "reg10", t: "reg", a: true, q: "Sulfonylurea계 당뇨약은 K⁺ 채널을 차단해 인슐린 분비를 늘리는 '약물' 촉진인자다.", why: "10p 촉진인자 – 약물: sulfonylurea(K⁺ 채널 차단)." },

    // ── GLUT · SGLT (P1 14p)
    { id: "glut1", t: "glut", a: true, q: "GLUT4는 골격근·심근·지방조직에 있으며 인슐린 의존성이다.", why: "14p에서 ★ 표시된 유일한 인슐린 의존성 수송체." },
    { id: "glut2", t: "glut", a: true, q: "GLUT4는 평소 세포 안 소포에 있다가 인슐린 자극 시 세포막으로 이동(translocation)해 포도당을 수송한다.", why: "‘자극 시 세포막으로 이동하여 수송’." },
    { id: "glut3", t: "glut", a: false, q: "GLUT2는 간·췌장 β세포·소장·신장에 있으며 인슐린 의존성이다.", why: "GLUT2는 인슐린 비의존성. 양방향 저친화성 수송, 센서 역할." },
    { id: "glut4", t: "glut", a: true, q: "GLUT2는 양방향·저친화성 수송체로, 포도당 센서 역할을 한다.", why: "간에서는 포도당을 내보낼 때도 GLUT2를 쓴다(양방향)." },
    { id: "glut5", t: "glut", a: true, q: "GLUT1은 뇌·적혈구·태반 등에서 기초 포도당 섭취(basal uptake)를 담당하며 인슐린 비의존성이다.", why: "그래서 뇌·RBC는 인슐린 없이도 포도당을 쓴다." },
    { id: "glut6", t: "glut", a: false, q: "간세포의 포도당 섭취는 GLUT4를 통해 인슐린에 의해 조절된다.", why: "간은 GLUT2(인슐린 비의존). 인슐린은 간에서 수송체가 아니라 효소(글리코겐 합성 등)를 조절." },
    { id: "glut7", t: "glut", a: true, q: "SGLT2는 신장 근위세뇨관에서 여과된 포도당의 80–90%를 재흡수한다.", why: "그래서 억제제가 임상에서 쓰인다." },
    { id: "glut8", t: "glut", a: false, q: "SGLT1은 주로 신장 근위세뇨관에서 여과 포도당 대부분을 재흡수하며, SGLT2는 소장에서 포도당을 흡수한다.", why: "반대. SGLT1 = 소장(+신장) 능동수송·ORS 원리, SGLT2 = 근위세뇨관 80–90% 재흡수." },
    { id: "glut9", t: "glut", a: true, q: "경구 수분 보충액(oral rehydration)의 원리는 소장의 SGLT1을 통한 포도당 능동수송이다.", why: "Na⁺–포도당 공동수송으로 물이 따라 흡수된다." },
    { id: "glut10", t: "glut", a: false, q: "SGLT2 억제제는 glycosuria를 일으켜 혈당을 낮추지만 저혈당 위험이 높다.", why: "저혈당 위험이 ‘낮다’. 인슐린 분비와 무관하게 소변으로 포도당을 버리기 때문." },
    { id: "glut11", t: "glut", a: true, q: "SGLT2 억제제는 A1C를 낮추고 체중과 혈압도 감소시킨다.", why: "14p 하단: 체중·혈압↓, 인슐린 민감도↑, 당신생↓, β세포 인슐린 분비 촉진." },

    // ── GLP-1 (P2 4p)
    { id: "glp1", t: "glp", a: true, q: "GLP-1은 주로 회장(ileum)과 대장의 L세포에서 만들어진다.", why: "Production site: intestinal L-cells (ileum, colon)." },
    { id: "glp2", t: "glp", a: true, q: "GLP-1과 glucagon은 같은 전구체(preproglucagon)에서 조직마다 다른 절단으로 만들어진다.", why: "α세포에서는 glucagon, L세포에서는 GLP-1·GLP-2." },
    { id: "glp4", t: "glp", a: true, q: "GLP-1은 가장 강력한 내인성 인슐린 분비 촉진제(insulin secretagogue)이다.", why: "‘The most potent endogenous insulin secretagogue’." },
    { id: "glp10", t: "glp", a: false, q: "GLP-1은 glucagon과 전구체가 같으므로 glucagon처럼 혈당을 올리는 쪽으로 작용한다.", why: "전구체만 같을 뿐, GLP-1은 가장 강력한 인슐린 분비 촉진제 → 혈당을 낮추는 쪽." },
    { id: "glp11", t: "glp", a: true, q: "포도당뿐 아니라 갈락토스나 아미노산을 먹어도 GLP-1이 분비된다.", why: "Secretory stimuli: oral glucose, galactose, amino acids." },
    { id: "glp5", t: "glp", a: true, q: "GLP-1은 인슐린 분비를 자극하는 요인들(경구 포도당·아미노산, 콜린성·β-adrenergic 자극)에 의해 분비가 자극된다.", why: "교수님 강조 포인트: GLP-1 분비 자극 인자 = 인슐린 분비 자극 인자와 겹친다." },

    // ── 포도당 항상성 5단계 (P3 5p)
    { id: "ph1", t: "phase", a: true, q: "Phase I의 혈당 주 출처는 외인성(식사) 포도당이고, 모든 조직이 포도당을 쓴다.", why: "표 1행." },
    { id: "ph2", t: "phase", a: true, q: "Phase II의 혈당 주 출처는 글리코겐과 간 당신생합성이며, 간을 제외한 조직이 포도당을 소비한다(근육·지방 소비는 감소).", why: "표 2행." },
    { id: "ph3", t: "phase", a: false, q: "Phase II에서 뇌의 주 연료는 케톤체이다.", why: "Phase I–III까지 뇌의 주 연료는 포도당. 케톤체는 IV부터." },
    { id: "ph4", t: "phase", a: true, q: "Phase III의 혈당 출처는 간 당신생합성과 글리코겐이다.", why: "II는 글리코겐 > 당신생, III는 당신생 > 글리코겐 순서로 적혀 있다." },
    { id: "ph5", t: "phase", a: false, q: "Phase III부터 혈당의 주 출처는 신장 당신생합성이다.", why: "‘간 및 신장’ 당신생이 혈당 출처로 나오는 건 Phase IV부터." },
    { id: "ph6", t: "phase", a: true, q: "혈당 유지를 위해 renal gluconeogenesis가 활발해지기 시작하는 시기는 Phase IV이다.", why: "IV·V: 당신생합성(간 및 신장).", ex: "작년 출족" },
    { id: "ph7", t: "phase", a: true, q: "Phase IV에서 포도당을 소비하는 조직은 뇌·적혈구·신장수질이고, 근육은 소량만 쓴다.", why: "표 4행." },
    { id: "ph8", t: "phase", a: true, q: "Phase IV에서 뇌는 포도당과 케톤체를 함께 쓴다.", why: "IV: 포도당, 케톤체 / V: 케톤체, 포도당 (앞이 주 연료)." },
    { id: "ph9", t: "phase", a: true, q: "Phase V에서 뇌의 주 연료는 케톤체이고, 뇌의 포도당 소비는 줄어든다.", why: "V: 뇌(소비감소) / 케톤체 > 포도당.", ex: "2025" },
    { id: "ph10", t: "phase", a: false, q: "Phase V에서는 적혈구도 케톤체를 주 연료로 쓴다.", why: "적혈구·신장수질은 끝까지 포도당. 그래서 IV·V에도 포도당 소비 조직으로 남아 있다." },
    { id: "ph11", t: "phase", a: true, q: "‘케톤체가 주 에너지원이 되고, RBC·신장수질의 포도당 소비는 유지되며, 뇌의 포도당 의존이 줄어드는 구간’은 Phase V가 원래 정답이었고 IV도 인정되었다.", why: "2025 기출 복수정답(④⑤). 근육이 IV에서 케톤체를 주로 쓰는 점이 인정됨.", ex: "2025" },
    { id: "ph12", t: "phase", a: false, q: "Phase II에서도 간은 혈액 속 외부 포도당을 주 연료로 쓴다.", why: "II부터 소비 조직은 ‘간 제외’. 간은 포도당을 만들어 내보내는 쪽." },

    // ── AMPK (P3 23p)
    { id: "am1", t: "ampk", a: true, q: "AMPK는 AMP/ATP 비율이 올라갈 때 활성화되는 에너지 결핍 센서이다.", why: "‘에너지가 결핍되어 있다’를 알려주는 센서." },
    { id: "am2", t: "ampk", a: true, q: "운동, 저산소증, 기아 상태는 AMPK를 활성화한다.", why: "이 상황에서 AMP 비중이 증가." },
    { id: "am3", t: "ampk", a: true, q: "AMPK가 활성화되면 glycolysis와 지방산 산화(β-oxidation)가 증가한다.", why: "ATP 생성 경로 촉진." },
    { id: "am4", t: "ampk", a: false, q: "AMPK가 활성화되면 간의 당신생합성이 촉진된다.", why: "당신생은 ATP 소비 경로 → 억제." },
    { id: "am5", t: "ampk", a: true, q: "AMPK 활성화는 단백질 합성과 지방산·콜레스테롤 합성을 억제한다.", why: "ATP 소비 경로 억제." },
    { id: "am6", t: "ampk", a: false, q: "AMPK는 ATP를 소비하는 경로를 촉진하고 ATP를 만드는 경로를 억제한다.", why: "정반대. ATP 생성↑, ATP 소비↓." },
    { id: "am7", t: "ampk", a: true, q: "AMPK를 활성화하면 혈당을 낮출 수 있다.", why: "강조 메모 그대로. 포도당 이용↑ + 당신생↓." },
    { id: "am8", t: "ampk", a: true, q: "Metformin은 AMPK를 활성화한다.", why: "운동·adiponectin·metformin → AMPK↑." },
    { id: "am9", t: "ampk", a: true, q: "2형 당뇨 환자에게 운동과 체중 감량이 도움이 되는 주요 기전은 AMPK 활성화이다.", why: "운동·체중 감소 → adiponectin↑ → AMPK↑ → 인슐린 감수성↑.", ex: "작년 출족" },
    // ── 식욕 조절 호르몬 (P3 28p)
    { id: "ap1", t: "app", a: true, q: "Leptin, insulin, PYY3-36, GLP-1은 식욕억제(anorexigenic) 호르몬이다.", why: "28p 왼쪽 묶음.", ex: "2018–2021" },
    { id: "ap2", t: "app", a: true, q: "식욕억제 호르몬들은 시상하부 arcuate nucleus에서 α-MSH 방출을 촉진하고 NPY 방출을 억제한다.", why: "“Eat less, metabolize more” 신호." },
    { id: "ap3", t: "app", a: true, q: "Ghrelin은 NPY 발현 세포를 활성화해 식욕을 촉진한다.", why: "“Eat more, metabolize less”." },
    { id: "ap4", t: "app", a: false, q: "Ghrelin은 지방조직에서 분비된다.", why: "Ghrelin은 위(fundus의 P/D1 세포, 췌장 ε세포). 지방조직은 leptin·adiponectin." },
    { id: "ap6", t: "app", a: false, q: "Leptin과 insulin은 NPY 방출을 촉진해 식욕을 억제한다.", why: "NPY는 ‘먹어라’ 신호. Leptin·insulin은 NPY를 억제하고 α-MSH를 촉진." },
    { id: "ap7", t: "app", a: true, q: "Adiponectin은 식욕촉진(orexigenic) 쪽에 넣어야 한다.", why: "교수님 메모 ‘Adiponectin 추가바람’. AMPK 활성 → NPY 분비↑ → food intake↑.", ex: "2021" },
    { id: "ap8", t: "app", a: false, q: "Adiponectin은 비만이 심할수록 혈중 농도가 높아진다.", why: "비만일수록 감소하는 독특한 역관계. 비만·2형 DM 환자는 낮다." },
    { id: "ap9", t: "app", a: true, q: "Adiponectin은 AMPK를 활성화하고 인슐린 감수성을 높이며, 동맥경화와 염증 반응을 줄인다.", why: "임상적 의미. 대사증후군·당뇨 평가 지표." },
    { id: "ap10", t: "app", a: true, q: "TZD(thiazolidinedione)는 adiponectin의 합성과 분비를 촉진한다.", why: "Metformin → AMPK, TZD → adiponectin." },
    { id: "ap11", t: "app", a: true, q: "식욕 조절 중추(시상하부)에서 분비되는 물질 중 식욕을 억제하는 것은 α-MSH와 CART이다.", why: "중추 – 촉진: NPY, AgRP / 억제: α-MSH, CART.", ex: "2019" },
    { id: "ap14", t: "app", a: true, q: "CCK와 secretin도 식욕을 억제하는 장 호르몬이다.", why: "장기 분비 – 억제: leptin, insulin, secretin, CCK, PYY3-36, GLP-1 (ghrelin·adiponectin만 촉진)." },

  ]
});
