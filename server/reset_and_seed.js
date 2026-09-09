const bcrypt = require('bcryptjs');
const db = require('./db');

const officialStudents = [
  { roll: 1, ug_id: '26UG033789', name: 'SAMOL YAHYA HABIB', phone: '9979529133', password: 'Samol@3223' },
  { roll: 2, ug_id: '26UG032660', name: 'SOLANKI NISHITH ANILBHAI', phone: '7984461142', password: 'Solanki@4008' },
  { roll: 3, ug_id: '26UG034583', name: 'MAKWANA RINKAL MANISHKUMAR', phone: '7984188428', password: 'Makwana@7697' },
  { roll: 4, ug_id: '26UG034141', name: 'MAKWANA RIYA VINODBHAI', phone: '7434051921', password: 'Bettu@2606' },
  { roll: 5, ug_id: '26UG030827', name: 'GUPTA NIDHI AJAYKUMAR', phone: '8490861802', password: 'Gupta@9371' },
  { roll: 6, ug_id: '26UG030513', name: 'VAGHELA JEET VIJAYBHAI', phone: '9624356870', password: 'Vaghela@8999' },
  { roll: 7, ug_id: '26UG030812', name: 'BAKRE HARSH RAMESHWARBHAI', phone: '6352784863', password: 'Bakre@2288' },
  { roll: 8, ug_id: '26UG030441', name: 'PATHAN ARMAN KHAN SADIK KHAN', phone: '9825746129', password: 'Pathan@5066' },
  { roll: 9, ug_id: '26UG032789', name: 'SHAH BHAVYA RIMPLE', phone: '8238738991', password: 'Shah@2250' },
  { roll: 10, ug_id: '26UG033347', name: 'PATEL RUDRAKUMAR NILESHKUMAR', phone: '9624389087', password: 'Patel@1586' },
  { roll: 11, ug_id: '26UG034115', name: 'PATEL DHRUV HARSHADBHAI', phone: '9512857085', password: 'Patel@2017' },
  { roll: 12, ug_id: '26UG030939', name: 'KARANGIYA YAKSH SARMANBHAI', phone: '9016643980', password: 'Karangiya@5028' },
  { roll: 13, ug_id: '26UG033181', name: 'ARVIND KUMAR', phone: '9471750496', password: 'Bunny@2606' },
  { roll: 14, ug_id: '26UG030567', name: 'SISODIYA SHEETAL MAANSINGH', phone: '9173701769', password: 'Sisodiya@3953' },
  { roll: 15, ug_id: '26UG034009', name: 'SOLANKI DHRUV BHUPENDRABHAI', phone: '9558681708', password: 'Solanki@9295' },
  { roll: 16, ug_id: '26UG035446', name: 'RANGOONWALA KRISH MAYUR', phone: '7016557320', password: 'Rangoonwala@4153' },
  { roll: 17, ug_id: '26UG033771', name: 'VAISHNAV BHUMIKA HEMANTBHAI', phone: '8200739987', password: 'Vaishnav@7289' },
  { roll: 18, ug_id: '26UG034575', name: 'MIHIT CHAPALA', phone: '8264390590', password: 'Mihit@9836' },
  { roll: 19, ug_id: '26UG033399', name: 'DUVVAPU ADITYA', phone: '9381313989', password: 'Duvvapu@5554' },
  { roll: 20, ug_id: '26UG035496', name: 'VASAVA DHRUV SHAILESHBHAI', phone: '8511808928', password: 'Vasava@5413' },
  { roll: 21, ug_id: '26UG035449', name: 'TADVI HARDIKKUMAR PRAVINBHAI', phone: '9586147241', password: 'Tadvi@9810' },
  { roll: 22, ug_id: '26UG034884', name: 'NIKAM PIYUSH RAVINDRA', phone: '7756857977', password: 'Nikam@3034' },
  { roll: 23, ug_id: '26UG035314', name: 'PATEL HETKUMAR BHARATBHAI', phone: '9313604438', password: 'Patel@7316' },
  { roll: 24, ug_id: '26UG035368', name: 'PUWAR MEGHAV SHAILENDRASINH', phone: '9825481615', password: 'Puwar@6288' },
  { roll: 25, ug_id: '26UG034993', name: 'RATHOD KARMA PRAHLADSINH', phone: '9106832244', password: 'Rathod@7878' },
  { roll: 26, ug_id: '26UG035346', name: 'PARMAR SWASTIK BHARATBHAI', phone: '8141173702', password: 'Parmar@5031' },
  { roll: 27, ug_id: '26UG030671', name: 'PATEL BHAVISHY MUKESHBHAI', phone: '6355299036', password: 'Patel@2347' },
  { roll: 28, ug_id: '26UG030440', name: 'JOSHI MANAV JITENDRA', phone: '7861931070', password: 'Joshi@4976' },
  { roll: 29, ug_id: '26UG034588', name: 'BHUSARE ARYAN TUSHAR', phone: '9834930237', password: 'Bhusare@2745' },
  { roll: 30, ug_id: '26UG033955', name: 'SHAIK KHUDAN SAHEB', phone: '7306111605', password: 'Shaik@9885' },
  { roll: 31, ug_id: '26UG035774', name: 'SONI PARTH JIGNESHBHAI', phone: '7359796686', password: 'Soni@5250' },
  { roll: 32, ug_id: '26UG035476', name: 'AMMISETTY GOPI CHANDH', phone: '9182396225', password: 'Ammisetty@4431' },
  { roll: 33, ug_id: '26UG036114', name: 'PARMAR MITAL NAVNEETBHAI', phone: '9328353142', password: 'Parmar@3642' },
  { roll: 34, ug_id: '26UG030542', name: 'DHODI ADITYA CHHOTU', phone: '9274855324', password: 'Dhodi@3275' },
  { roll: 36, ug_id: '26UG036196', name: 'VASAVA VAISHNAV JAYANTIBHAI', phone: '6352298045', password: 'Vasava@1750' },
  { roll: 37, ug_id: '26UG032969', name: 'PODUGU MEGHANA', phone: '7093086092', password: 'Podugu@9229' },
  { roll: 38, ug_id: '26UG036152', name: 'MONANI YASH JASMIN', phone: '9512067634', password: 'Monani@1570' },
  { roll: 39, ug_id: '26UG035395', name: 'SHARMA HIMAY', phone: '8866929133', password: 'Sharma@3418' },
  { roll: 40, ug_id: '26UG030419', name: 'PATEL RIYA BHAVESHBHAI', phone: '9714616448', password: 'Patel@9386' },
  { roll: 41, ug_id: '26UG031486', name: 'VAGHELA JAYVIRSINH M', phone: '9664817236', password: 'Vaghela@4139' },
  { roll: 42, ug_id: '26UG035996', name: 'PATIL PRATHAMESH KIRAN', phone: '9974589106', password: 'Patil@7738' },
  { roll: 43, ug_id: '26UG035978', name: 'KARAMPURI SURENDRA SATANARAYAN', phone: '9427441944', password: 'Karampuri@2288' },
  { roll: 44, ug_id: '26UG036552', name: 'LAVANYA DEVENDRA PATIL', phone: '8999022348', password: 'Lavanya@8282' },
  { roll: 45, ug_id: '26UG036521', name: 'TUNARA SAUMYA RAHULBHAI', phone: '9173666777', password: 'Tunara@1412' },
  { roll: 46, ug_id: '26UG036238', name: 'PRAJAPATI BHUMI KALPESHKUMAR', phone: '9313272430', password: 'Prajapati@7894' },
  { roll: 47, ug_id: '26UG036229', name: 'BARIYA NIMESH NANDUBHAI', phone: '7016664583', password: 'Bariya@1795' },
  { roll: 48, ug_id: '26UG030523', name: 'KOMAL SANDEEP PARTE', phone: '7490045832', password: 'Komal@4071' },
  { roll: 49, ug_id: '26UG036848', name: 'BARIA NIKHIL TAKHATSINH', phone: '9023233635', password: 'Baria@5578' },
  { roll: 50, ug_id: '26UG036163', name: 'ROUTH GOKUL SAI', phone: '6370031255', password: 'Routh@5431' },
  { roll: 51, ug_id: '26UG036654', name: 'PRAJAPATI CHAITANYA FALGUNI', phone: '9104389389', password: 'Prajapati@3953' },
  { roll: 52, ug_id: '26UG036506', name: 'JANI KALP PREMALKUMAR', phone: '8141557724', password: 'Jani@7717' },
  { roll: 53, ug_id: '26UG036120', name: 'PARMAR PRATHAM RAJNIKANT', phone: '9157089774', password: 'Parmar@2942' },
  { roll: 54, ug_id: '26UG036512', name: 'PATEL KALP SURESHBHAI', phone: '7359609715', password: 'Patel@2155' },
  { roll: 55, ug_id: '26UG036511', name: 'SOLANKI DEVANG KISHORBHAI', phone: '9898672913', password: 'Solanki@8707' },
  { roll: 56, ug_id: '26UG033993', name: 'BORRA CHARAN TEJA', phone: '9059727273', password: 'Borra@4195' },
  { roll: 57, ug_id: '26UG036815', name: 'RASHI KANKARIYA', phone: '8824171543', password: 'Rashi@1320' },
  { roll: 58, ug_id: '26UG036651', name: 'DAWLA KHURRAIM MOHAMMED SOHEL', phone: '9173992111', password: 'Dawla@2256' },
  { roll: 59, ug_id: '26UG036876', name: 'MALI VIVEK MAHESHBHAI', phone: '9409684157', password: 'Mali@1944' },
  { roll: 60, ug_id: '26UG036819', name: 'UPADHYAY DHVANI VIPULKUMAR', phone: '9016930825', password: 'Upadhyay@5913' },
  { roll: 61, ug_id: '26UG036662', name: 'ABHINAV KUMAR', phone: '9730133801', password: 'Abhinav@8473' },
  { roll: 62, ug_id: '26UG035304', name: 'VAGHELA NEEL ANILBHAI', phone: '6355471516', password: 'Vaghela@2253' },
  { roll: 63, ug_id: '26UG030802', name: 'KAYASTHA PREET HEMALKUMAR', phone: '8780648812', password: 'Kayastha@5333' },
  { roll: 64, ug_id: '26UG036397', name: 'HARSH VIMALKUMAR THAKAR', phone: '7016771978', password: 'Harsh@6368' },
  { roll: 65, ug_id: '26UG036530', name: 'DABHI SAHAJ SUNILKUMAR', phone: '9033402388', password: 'Dabhi@8037' },
  { roll: 66, ug_id: '26UG036930', name: 'SHAH JITABH CHIRAGBHAI', phone: '9825403868', password: 'Shah@7832' }
];

async function resetAndSeed() {
  console.log('====================================================');
  console.log('🔄 STARTING COMPLETE DATABASE RESET & SEEDING');
  console.log('====================================================');

  await db.initDB();

  // 1. Purge Demo Data (while preserving Timetable, Subjects, App Settings)
  console.log('[1/4] Purging demo data from tables...');
  await db.run("DELETE FROM class_notes");
  await db.run("DELETE FROM study_material");
  await db.run("DELETE FROM assignments");
  await db.run("DELETE FROM assignment_submissions");
  await db.run("DELETE FROM question_papers");
  await db.run("DELETE FROM attendance_records");
  await db.run("DELETE FROM attendance_manual");
  await db.run("DELETE FROM attendance_audit_logs");
  await db.run("DELETE FROM attendance_sessions");
  await db.run("DELETE FROM results");
  await db.run("DELETE FROM notifications");
  await db.run("DELETE FROM announcements");
  await db.run("DELETE FROM academic_calendar");
  await db.run("DELETE FROM ai_knowledge");

  // Remove existing students and student auth records
  await db.run("DELETE FROM students");
  await db.run("DELETE FROM users WHERE role = 'STUDENT'");

  console.log('✅ Demo records purged successfully.');

  // 2. Ensure Admin User exists
  const adminUser = await db.get("SELECT * FROM users WHERE username = 'Bettu&Bunny' OR role = 'ADMIN'");
  const adminPassHash = await bcrypt.hash('Bettu&bunny@9135', 10);
  if (!adminUser) {
    await db.run(
      "INSERT INTO users (role, username, password_hash, status) VALUES ('ADMIN', 'Bettu&Bunny', ?, 'ACTIVE')",
      [adminPassHash]
    );
    console.log('✅ Admin user created: Bettu&Bunny / Bettu&bunny@9135');
  } else {
    await db.run(
      "UPDATE users SET username = 'Bettu&Bunny', password_hash = ?, status = 'ACTIVE' WHERE id = ?",
      [adminPassHash, adminUser.id]
    );
    console.log('✅ Admin user confirmed & updated: Bettu&Bunny');
  }

  // 3. Register All 65 Official Students
  console.log(`[2/4] Registering ${officialStudents.length} official 3CYBER7 students...`);
  
  for (const s of officialStudents) {
    const batch = s.roll <= 30 ? 'Batch 1' : 'Batch 2';
    const passwordHash = await bcrypt.hash(s.password, 10);

    // Insert Student Record
    await db.run(`
      INSERT INTO students (
        ug_id, name, roll_number, phone_number, password_hash, batch, program, year, semester, division, academic_year, status
      ) VALUES (?, ?, ?, ?, ?, ?, 'B.Tech Cyber Security', '2nd Year', '3rd Semester', '3CYBER7', '2026-27', 'ACTIVE')
    `, [s.ug_id, s.name, s.roll, s.phone, passwordHash, batch]);

    // Insert User Authentication Record
    await db.run(`
      INSERT INTO users (role, ug_id, password_hash, status)
      VALUES ('STUDENT', ?, ?, 'ACTIVE')
    `, [s.ug_id, passwordHash]);
  }

  console.log(`✅ Successfully registered all ${officialStudents.length} students!`);

  // 4. Verification & Statistics
  console.log('[3/4] Running verification queries...');
  const totalStudents = await db.get("SELECT COUNT(*) as count FROM students");
  const batch1Count = await db.get("SELECT COUNT(*) as count FROM students WHERE batch = 'Batch 1'");
  const batch2Count = await db.get("SELECT COUNT(*) as count FROM students WHERE batch = 'Batch 2'");
  const totalUsers = await db.get("SELECT COUNT(*) as count FROM users");
  const totalTimetable = await db.get("SELECT COUNT(*) as count FROM timetable");
  const totalSubjects = await db.get("SELECT COUNT(*) as count FROM subjects");
  const notesCount = await db.get("SELECT COUNT(*) as count FROM class_notes");
  const resultsCount = await db.get("SELECT COUNT(*) as count FROM results");
  const attendanceCount = await db.get("SELECT COUNT(*) as count FROM attendance_records");

  console.log('====================================================');
  console.log('📊 DATABASE STATE SUMMARY:');
  console.log(`- Total Registered Students : ${totalStudents.count}`);
  console.log(`  • Batch 1 (Roll 1-30)     : ${batch1Count.count}`);
  console.log(`  • Batch 2 (Roll 31-66)    : ${batch2Count.count}`);
  console.log(`- Total Auth Users          : ${totalUsers.count} (65 Students + 1 Admin)`);
  console.log(`- Timetable Entries (Kept)  : ${totalTimetable.count}`);
  console.log(`- Subjects (Kept)           : ${totalSubjects.count}`);
  console.log(`- Class Notes (Clean)       : ${notesCount.count}`);
  console.log(`- Results (Clean)           : ${resultsCount.count}`);
  console.log(`- Attendance Records (Clean): ${attendanceCount.count}`);
  console.log('====================================================');

  // Test sample login verification
  console.log('[4/4] Testing sample login authentications:');
  const testCases = [
    { label: 'Student 1 (Batch 1)', ug_id: '26UG033789', pass: 'Samol@3223' },
    { label: 'Student 13 (Batch 1)', ug_id: '26UG033181', pass: 'Arvind@7886' },
    { label: 'Student 36 (Batch 2)', ug_id: '26UG036196', pass: 'Vasava@1750' },
    { label: 'Student 66 (Batch 2)', ug_id: '26UG036930', pass: 'Shah@7832' }
  ];

  for (const t of testCases) {
    const rec = await db.get("SELECT * FROM students WHERE ug_id = ?", [t.ug_id]);
    const valid = rec && (await bcrypt.compare(t.pass, rec.password_hash));
    console.log(`  • ${t.label}: ${t.ug_id} -> Auth ${valid ? '✅ SUCCESS' : '❌ FAILED'} (${rec ? rec.name : 'Not found'})`);
  }

  console.log('====================================================');
  console.log('🎉 ALL DONE! STUDENT PORTAL IS FRESH & READY.');
  console.log('====================================================');
  process.exit(0);
}

resetAndSeed().catch(err => {
  console.error('Fatal Error during reset and seed:', err);
  process.exit(1);
});
