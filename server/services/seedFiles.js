const fs = require('fs');
const path = require('path');

// Basic minimal valid PDF binary template
function createMinimalPDF(title, subject, desc) {
  const content = `BT
/F1 18 Tf
50 720 Td
(${title.replace(/[\(\)]/g, '')}) Tj
/F1 12 Tf
0 -30 Td
(Subject: ${subject.replace(/[\(\)]/g, '')}) Tj
0 -20 Td
(Division: 3CYBER7 - Mishra Group Institute) Tj
0 -20 Td
(${desc.replace(/[\(\)]/g, '')}) Tj
0 -30 Td
(Official Academic Document - Verified & Approved) Tj
ET`;

  const streamLen = Buffer.byteLength(content, 'utf8');

  return `%PDF-1.4
1 0 obj
<< /Title (${title}) /Author (Mishra Group Institute) /Creator (Academic Portal) >>
endobj
2 0 obj
<< /Type /Catalog /Pages 3 0 R >>
endobj
3 0 obj
<< /Type /Pages /Kids [4 0 R] /Count 1 >>
endobj
4 0 obj
<< /Type /Page /Parent 3 0 R /MediaBox [0 0 612 792] /Contents 5 0 R /Resources << /Font << /F1 6 0 R >> >> >>
endobj
5 0 obj
<< /Length ${streamLen} >>
stream
${content}
endstream
endobj
6 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 7
0000000000 65535 f
0000000009 00000 n
0000000100 00000 n
0000000150 00000 n
0000000210 00000 n
0000000340 00000 n
0000000520 00000 n
trailer
<< /Size 7 /Root 2 0 R /Info 1 0 R >>
startxref
590
%%EOF
`;
}

// Ensure sample files exist in upload directories
function ensureSampleFiles() {
  const dirs = {
    notes: path.join(__dirname, '..', '..', 'uploads', 'notes'),
    material: path.join(__dirname, '..', '..', 'uploads', 'material'),
    assignments: path.join(__dirname, '..', '..', 'uploads', 'assignments'),
    papers: path.join(__dirname, '..', '..', 'uploads', 'papers'),
    photos: path.join(__dirname, '..', '..', 'uploads', 'photos')
  };

  Object.values(dirs).forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });

  const filesToCreate = [
    // Fallback files
    { dir: dirs.notes, name: 'sample_notes.pdf', title: 'Sample Class Notes', subject: 'Cyber Security', desc: 'B.Tech Cyber Security Class Notes' },
    { dir: dirs.material, name: 'sample_material.pdf', title: 'Sample Study Material', subject: 'Cyber Security', desc: 'Reference Manual and Study Guides' },
    { dir: dirs.assignments, name: 'sample_assignment.pdf', title: 'Sample Assignment Sheet', subject: 'Cyber Security', desc: 'Problem Statements and Due Dates' },
    { dir: dirs.papers, name: 'sample_paper.pdf', title: 'Sample Question Paper', subject: 'Cyber Security', desc: 'Previous Semester Examination Paper' },

    // Subject Specific Notes
    { dir: dirs.notes, name: 'DBMS_Unit1_Relational_Model.pdf', title: 'DBMS Unit 1: Relational Data Model & ER', subject: 'DBMS', desc: 'ER Diagrams, Keys, Normalization Rules' },
    { dir: dirs.notes, name: 'DSA_Unit2_Trees_Graphs.pdf', title: 'DSA Unit 2: Trees, Graphs & Traversal Algorithms', subject: 'DSA', desc: 'BST, AVL Trees, BFS, DFS, Dijkstra' },
    { dir: dirs.notes, name: 'NCS_Unit1_Cryptography_Basics.pdf', title: 'NCS Unit 1: Modern Cryptography & Ciphers', subject: 'NCS', desc: 'AES, RSA, SHA-256, Digital Signatures' },
    { dir: dirs.notes, name: 'JAVA_Unit3_Multithreading_Collections.pdf', title: 'JAVA Unit 3: Multithreading & Collections Framework', subject: 'JAVA', desc: 'Threads, Synchronization, ArrayList, HashMap' },
    { dir: dirs.notes, name: 'COMA_Unit2_Instruction_Set.pdf', title: 'COMA Unit 2: Microprocessor Architecture & ALU', subject: 'COMA', desc: 'Registers, Addressing Modes, Instruction Cycles' },
    { dir: dirs.notes, name: 'DM_Unit1_Set_Theory_Relations.pdf', title: 'DM Unit 1: Set Theory, Relations & Functions', subject: 'DM', desc: 'Equivalence Relations, Posets, Lattices' },
    { dir: dirs.notes, name: 'FCS_Unit1_Cyber_Threat_Landscape.pdf', title: 'FCS Unit 1: Cyber Threat Landscape & Defense', subject: 'FCS', desc: 'Threat Models, CIA Triad, Vulnerability Management' },

    // Study Materials
    { dir: dirs.material, name: 'DBMS_SQL_CheatSheet.pdf', title: 'DBMS SQL & Query Optimization Cheat Sheet', subject: 'DBMS', desc: 'SQL Queries, Joins, Indexing, Transactions' },
    { dir: dirs.material, name: 'DSA_Data_Structures_Lab_Manual.pdf', title: 'DSA Lab Experiments Manual (C++ & Java)', subject: 'DSA', desc: 'Lab Experiments 1-12 with Code Solutions' },
    { dir: dirs.material, name: 'NCS_Network_Security_Handbook.pdf', title: 'Network Security Tools Handbook & Commands', subject: 'NCS', desc: 'Wireshark, Nmap, Metasploit, Snort Guides' },

    // Question Papers
    { dir: dirs.papers, name: 'DBMS_EndSem_Paper_2025.pdf', title: 'DBMS End-Semester Final Exam Paper (2025-26)', subject: 'DBMS', desc: 'Official 70 Marks University Question Paper' },
    { dir: dirs.papers, name: 'DSA_MidSem_Paper_2026.pdf', title: 'DSA Mid-Semester Exam Paper (2026-27)', subject: 'DSA', desc: 'Official 30 Marks Mid-Sem Question Paper' },
    { dir: dirs.papers, name: 'NCS_EndSem_Paper_2025.pdf', title: 'NCS End-Semester Examination Paper (2025-26)', subject: 'NCS', desc: 'Official 70 Marks Network Security Paper' }
  ];

  filesToCreate.forEach(f => {
    const target = path.join(f.dir, f.name);
    if (!fs.existsSync(target)) {
      const pdf = createMinimalPDF(f.title, f.subject, f.desc);
      fs.writeFileSync(target, pdf, 'utf8');
      console.log(`[SeedFiles] Created sample file: ${f.name}`);
    }
  });
}

module.exports = { ensureSampleFiles, createMinimalPDF };
