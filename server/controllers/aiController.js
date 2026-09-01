const db = require('../db');

// AI Academic Knowledge Base & Rule-based Intelligent Engine
const SUBJECT_KNOWLEDGE = {
  DBMS: {
    name: 'Database Management System (CS301)',
    faculty: 'Prof. N. Wagh (NW)',
    topics: {
      normalization: 'Normalization is the process of organizing relational database tables to reduce data redundancy and eliminate anomalies (Insertion, Deletion, Update anomalies).\n- 1NF: Atomic values only (no repeating groups).\n- 2NF: In 1NF and all non-key attributes are fully functionally dependent on the Primary Key (no partial dependency).\n- 3NF: In 2NF and no transitive dependencies ($X \\rightarrow Y, Y \\rightarrow Z$).\n- BCNF: For every functional dependency $X \\rightarrow Y$, $X$ must be a super key.',
      er_model: 'Entity-Relationship Model represents real-world entities and relationships using Rectangles (Entities), Diamonds (Relationships), Ellipses (Attributes), and Underlined text (Primary Keys). Cardinality includes 1:1, 1:N, N:M.',
      acid: 'ACID Properties guarantee reliable database transactions:\n1. Atomicity: All operations in a transaction succeed, or none do ("All or Nothing").\n2. Consistency: Database remains in a valid state before and after transaction execution.\n3. Isolation: Concurrent transactions do not interfere with one another.\n4. Durability: Once committed, changes survive system crashes.',
      indexing: 'Indexing speeds up data retrieval using B-Trees / B+ Trees without scanning every table row. Clustered indexes dictate physical storage order, while Non-clustered indexes use pointers.',
      sql: 'SQL (Structured Query Language) contains DDL (CREATE, ALTER, DROP), DML (SELECT, INSERT, UPDATE, DELETE), DCL (GRANT, REVOKE), and TCL (COMMIT, ROLLBACK).'
    }
  },
  NCS: {
    name: 'Network & Cyber Security (CS304)',
    faculty: 'Prof. L. Varma (LV) & Prof. A. Parmar (AP)',
    topics: {
      cryptography: 'Cryptography secures communication using mathematical ciphers.\n- Symmetric Encryption: Single shared key for encryption & decryption (e.g. AES, DES, 3DES, ChaCha20).\n- Asymmetric Encryption: Key pair comprising a Public Key (encryption) and Private Key (decryption) (e.g. RSA, ECC, Diffie-Hellman).\n- Hash Functions: One-way cryptographic hashing (SHA-256, SHA-3) providing data integrity.',
      rsa: 'RSA Algorithm steps:\n1. Choose two large prime numbers $p$ and $q$.\n2. Compute $n = p \\times q$ and $\\phi(n) = (p-1)(q-1)$.\n3. Choose integer $e$ such that $1 < e < \\phi(n)$ and $\\gcd(e, \\phi(n)) = 1$.\n4. Compute private exponent $d \\equiv e^{-1} \\pmod{\\phi(n)}$.\n5. Encryption: $C = M^e \\pmod n$.\n6. Decryption: $M = C^d \\pmod n$.',
      firewalls: 'Firewalls monitor and filter incoming/outgoing traffic based on security policies: Packet Filtering, Stateful Inspection, Application Layer (WAF), and Next-Gen Firewalls (NGFW).',
      cia_triad: 'The CIA Triad is the core cyber security model:\n- Confidentiality: Protecting sensitive data from unauthorized disclosure.\n- Integrity: Ensuring data is accurate, consistent, and unaltered.\n- Availability: Guaranteeing authorized users have timely, reliable access to assets.'
    }
  },
  DSA: {
    name: 'Data Structures & Algorithms (CS303)',
    faculty: 'Prof. J. Chaudhari (JC) & T3',
    topics: {
      avl_tree: 'An AVL Tree is a self-balancing Binary Search Tree where the Balance Factor $|BF| \\le 1$ for every node ($BF = \\text{Height}(Left) - \\text{Height}(Right)$).\nRotations:\n- LL Rotation: Single Right Rotation\n- RR Rotation: Single Left Rotation\n- LR Rotation: Left-Right Double Rotation\n- RL Rotation: Right-Left Double Rotation\nSearch, Insert, and Delete time complexity: $O(\\log n)$.',
      graphs: 'Graph traversal algorithms:\n- BFS (Breadth-First Search): Uses Queue, explores level by level, time complexity $O(V+E)$. Ideal for shortest path on unweighted graphs.\n- DFS (Depth-First Search): Uses Stack/Recursion, explores branches as deeply as possible, time complexity $O(V+E)$.\n- Dijkstra Algorithm: Greedy algorithm for single-source shortest path with non-negative edge weights using Min-Heap ($O(E \\log V)$).',
      sorting: 'Sorting Complexities:\n- QuickSort: Average $O(n \\log n)$, Worst $O(n^2)$, In-place.\n- MergeSort: Guaranteed $O(n \\log n)$, Stable, requires $O(n)$ auxiliary memory.\n- HeapSort: Guaranteed $O(n \\log n)$, In-place using Max-Heap.'
    }
  },
  JAVA: {
    name: 'Object Oriented Programming with Java (CS306)',
    faculty: 'Prof. S. Upadhyay (SU) & Prof. V. Patel (VP)',
    topics: {
      oops: 'Core 4 Pillars of OOPs in Java:\n1. Encapsulation: Binding data (variables) and code (methods) together within a class with private access and getters/setters.\n2. Abstraction: Hiding implementation details using abstract classes and interfaces.\n3. Inheritance: Reusing code from a Superclass via `extends` keyword.\n4. Polymorphism: Compile-time (Method Overloading) and Runtime (Method Overriding with dynamic method dispatch).',
      multithreading: 'Multithreading allows concurrent task execution.\n- Creation: Extending `Thread` class or implementing `Runnable` interface.\n- Synchronization: `synchronized` keyword prevents race conditions by locking object monitors.\n- Inter-thread communication: `wait()`, `notify()`, `notifyAll()` methods.',
      collections: 'Java Collections Framework:\n- List: `ArrayList` (fast index access), `LinkedList` (fast insertions).\n- Set: `HashSet` (unique, unordered), `TreeSet` (sorted using Red-Black Tree).\n- Map: `HashMap` (key-value pairs, $O(1)$ lookup), `TreeMap` (sorted keys).'
    }
  },
  COMA: {
    name: 'Computer Organization & Microprocessor Architecture (CS307)',
    faculty: 'Prof. S. P. Bhatt (SPB), SS & RS',
    topics: {
      pipelining: 'Pipelining overlaps instruction execution across stages (Fetch, Decode, Execute, Memory, Write-Back). Hazards:\n1. Structural Hazards: Resource conflict (e.g. single memory for instructions & data).\n2. Data Hazards: RAW (Read After Write), WAR, WAW dependencies.\n3. Control Hazards: Branch instructions altering program counter.',
      memory_hierarchy: 'Memory hierarchy balances speed vs cost: Registers (fastest, smallest) $\\rightarrow$ L1/L2/L3 Cache $\\rightarrow$ Main Memory (DRAM) $\\rightarrow$ SSD / Secondary Storage.'
    }
  },
  DM: {
    name: 'Discrete Mathematics (CS302)',
    faculty: 'Prof. R. A. Patel (RAP)',
    topics: {
      set_theory: 'Set operations: Union ($A \\cup B$), Intersection ($A \\cap B$), Difference ($A \\setminus B$), Cartesian Product ($A \\times B$), Power Set ($2^n$ subsets). Relations: Reflexive, Symmetric, Transitive, Equivalence Relation.',
      logic: 'Propositional Logic connects propositions with AND ($\\land$), OR ($\\lor$), NOT ($\\neg$), Conditional ($P \\rightarrow Q$), Bi-conditional ($P \\leftrightarrow Q$). De Morgan’s Laws: $\\neg(P \\land Q) \\equiv \\neg P \\lor \\neg Q$.'
    }
  }
};

// 1. Connect with AI - Academic Query Endpoint (Requirement #49, #50)
async function chatWithAI(req, res) {
  try {
    const { prompt, contextSubject } = req.body;
    const studentUser = req.user;

    if (!prompt || prompt.trim() === '') {
      return res.status(400).json({ success: false, message: 'Please enter an academic question or prompt.' });
    }

    const queryText = prompt.trim().toLowerCase();

    // ==================== SECURITY & PRIVACY GUARDRAILS (Requirement #50) ====================
    const forbiddenPatterns = [
      /password/i, /admin credentials/i, /other student/i, /someone else's result/i,
      /show all marks/i, /database table schema/i, /drop table/i, /delete student/i,
      /hack/i, /bypass attendance/i, /fake gps/i, /spoof location/i
    ];

    for (const pattern of forbiddenPatterns) {
      if (pattern.test(queryText)) {
        return res.json({
          success: true,
          response: `🛡️ **Security Notice**: I am your **Mishra Group Institute Academic AI Tutor**. I am programmed with strict privacy & security protocols.\n\nI cannot access, reveal, or assist with private student data, passwords, administrative controls, or system modifications.\n\n💡 *How can I help you with your B.Tech Cyber Security coursework (DBMS, DSA, Java, NCS, FCS, COMA, DM) today?*`
        });
      }
    }

    // ==================== CONTEXTUAL ACADEMIC RETRIEVAL ====================
    let detectedSubject = contextSubject || null;

    if (!detectedSubject) {
      if (/dbms|database|sql|normalization|acid|relational|er diagram|bcnf/i.test(queryText)) detectedSubject = 'DBMS';
      else if (/ncs|network security|crypto|rsa|aes|firewall|cia triad|encryption/i.test(queryText)) detectedSubject = 'NCS';
      else if (/dsa|data structure|algorithm|tree|avl|graph|bfs|dfs|dijkstra|sorting|quicksort/i.test(queryText)) detectedSubject = 'DSA';
      else if (/java|oops|class|object|inheritance|polymorphism|multithreading|thread|collection/i.test(queryText)) detectedSubject = 'JAVA';
      else if (/coma|computer organization|pipeline|processor|cache|memory hierarchy/i.test(queryText)) detectedSubject = 'COMA';
      else if (/discrete|math|logic|truth table|set theory|graph theory/i.test(queryText)) detectedSubject = 'DM';
      else if (/fcs|cyber security fundamentals|forensics/i.test(queryText)) detectedSubject = 'FCS';
    }

    // Fetch related class notes from database to provide syllabus-grounded answer
    let relevantNotes = [];
    if (detectedSubject) {
      relevantNotes = await db.query(
        "SELECT title, unit, chapter, topic, description FROM class_notes WHERE subject = ? LIMIT 3",
        [detectedSubject]
      );
    }

    // Generate Comprehensive Structured AI Response
    let responseMarkdown = '';

    if (detectedSubject && SUBJECT_KNOWLEDGE[detectedSubject]) {
      const subjectInfo = SUBJECT_KNOWLEDGE[detectedSubject];
      responseMarkdown += `### 🎓 ${subjectInfo.name}\n**Course Faculty**: ${subjectInfo.faculty}\n\n`;

      // Match subtopics
      let topicFound = false;
      for (const [key, explanation] of Object.entries(subjectInfo.topics)) {
        if (queryText.includes(key) || queryText.includes(key.replace('_', ' '))) {
          responseMarkdown += `#### 📖 Key Concept: ${key.toUpperCase().replace('_', ' ')}\n${explanation}\n\n`;
          topicFound = true;
          break;
        }
      }

      if (!topicFound) {
        // Provide broad syllabus summary + guide
        const firstTopicKey = Object.keys(subjectInfo.topics)[0];
        responseMarkdown += `**Summary of ${detectedSubject}**: ${subjectInfo.topics[firstTopicKey]}\n\n`;
      }

      if (relevantNotes.length > 0) {
        responseMarkdown += `---\n#### 📚 Available Official Notes for ${detectedSubject}:\n`;
        relevantNotes.forEach(n => {
          responseMarkdown += `- **${n.unit}**: *${n.title}* (${n.chapter} - ${n.topic})\n`;
        });
        responseMarkdown += `\n*You can open and download these full PDF notes in the **Study Hub**.*`;
      }
    } else if (/today|class|timetable|schedule/i.test(queryText)) {
      const todayClasses = await db.query(
        "SELECT * FROM timetable WHERE active = 1 AND (batch = ? OR batch = 'Both') ORDER BY start_time ASC",
        [studentUser ? studentUser.batch : 'Batch 2']
      );

      responseMarkdown += `### 📅 Today's Academic Schedule (Division: 3CYBER7)\n\n`;
      if (todayClasses.length > 0) {
        todayClasses.forEach(c => {
          responseMarkdown += `• **${c.start_time} - ${c.end_time}**: ${c.subject} (${c.teacher}) in **Room ${c.room}** [${c.batch}]\n`;
        });
      } else {
        responseMarkdown += `No further classes scheduled for today. Check your Timetable tab for the full weekly plan!`;
      }
    } else {
      // General Academic Assistance for Cyber Security
      responseMarkdown += `### 🤖 B.Tech Cyber Security Academic Assistant\n\n`;
      responseMarkdown += `Hello **${studentUser ? studentUser.name : 'Student'}**! I am here to help you excel in your 3rd Semester coursework for Division **3CYBER7**.\n\n`;
      responseMarkdown += `You can ask me to:\n`;
      responseMarkdown += `1. 📚 **Explain Core Concepts**: Ask about **DBMS Normalization**, **RSA Algorithm in NCS**, **AVL Trees in DSA**, or **Java Multithreading**.\n`;
      responseMarkdown += `2. 📝 **Summarize Notes**: Type *"Summarize DBMS Unit 1"* or *"Explain RSA Cryptography"*.\n`;
      responseMarkdown += `3. 🎯 **Exam Preparation**: Ask for practice numericals, time complexities, or architectural diagrams.\n`;
      responseMarkdown += `4. ⏰ **Class Schedule**: Ask *"What is my next class?"* or *"Today's classes"*.\n\n`;
      responseMarkdown += `*Feel free to type any academic topic or question!*`;
    }

    return res.json({
      success: true,
      subject: detectedSubject,
      response: responseMarkdown
    });
  } catch (err) {
    console.error('[AIController] chatWithAI error:', err);
    return res.status(500).json({ success: false, message: 'AI Tutor service encountered a temporary error.' });
  }
}

module.exports = {
  chatWithAI
};
