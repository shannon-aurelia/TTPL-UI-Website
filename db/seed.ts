import { db } from './index';
import { users, assistants, news } from './schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('Seeding database...');

  // 1. Seed default assistant user
  const passwordHash = await bcrypt.hash('password123', 10);
  const existingUser = await db.select().from(users).where(eq(users.email, 'assistant@ttpl.com'));
  
  if (existingUser.length === 0) {
    await db.insert(users).values({
      id: 'default-assistant',
      email: 'assistant@ttpl.com',
      passwordHash,
      name: 'Default Assistant',
      role: 'assistant',
      createdAt: Date.now()
    });
    console.log('✔ Default assistant user created: assistant@ttpl.com / password123');
  }

  // 2. Seed assistants
  const existingAssistants = await db.select().from(assistants);
  if (existingAssistants.length === 0) {
    const currentBatch = [
      'Shannon Aurelia W.', 'Alief Rizki F.', 'Raudana M.', 
      'Abdul Jafor M.', 'Dominick Dexter G.', 'Naila Faiza'
    ];
    
    const e23 = [
      ['Adrian Idham Alfarizi', '/people/adrian-idham-alfarizi.jpg'],
      ['M. Fathoni', '/people/m-fathoni.jpg'],
      ['Faddlin Alwan Hanafi H.', '/people/faddlin-alwan-hanafi.jpg'],
      ['Alshandra Aurelya Walangadi', '/people/alshandra-aurelya.jpg'],
      ['Rafandra Gifarrel Maritza A.', '/people/rafandra-gifarrel.jpg'],
      ['Muhammad Gavin Jericho', '/people/muhammad-gavin-jericho.jpg']
    ];
    
    const e22 = [
      ['Belva Alisha Alam', '/people/belva-alisha.jpg'],
      ['Daffa Arbika', '/people/daffa-arbika.jpg'],
      ['Mochamad Raihan Triadi', '/people/mochamad-raihan.jpg'],
      ['Fawwaz Niko Hadisatrio', '/people/fawwaz-niko.jpg'],
      ['Muhammad Hanif Mawla', '/people/muhammad-hanif.jpg']
    ];

    let count = 0;
    // Insert 2024 active
    for (const name of currentBatch) {
      await db.insert(assistants).values({
        id: `ast-2024-${count++}`,
        name,
        roleType: 'assistant',
        portraitUrl: null,
        batch: '2024',
        email: `${name.toLowerCase().replace(/[^a-z]/g, '')}@ui.ac.id`,
        instagram: `@${name.toLowerCase().replace(/[^a-z]/g, '')}`
      });
    }

    // Insert E23
    for (const [name, img] of e23) {
      await db.insert(assistants).values({
        id: `ast-2023-${count++}`,
        name,
        roleType: 'assistant',
        portraitUrl: img,
        batch: 'Elektro 23',
        email: `${name.toLowerCase().replace(/[^a-z]/g, '')}@ui.ac.id`,
        instagram: `@${name.toLowerCase().replace(/[^a-z]/g, '')}`
      });
    }

    // Insert E22
    for (const [name, img] of e22) {
      await db.insert(assistants).values({
        id: `ast-2022-${count++}`,
        name,
        roleType: 'alumni',
        portraitUrl: img,
        batch: 'Elektro 22',
        email: `${name.toLowerCase().replace(/[^a-z]/g, '')}@ui.ac.id`,
        instagram: `@${name.toLowerCase().replace(/[^a-z]/g, '')}`
      });
    }

    console.log(`✔ Seeded ${count} assistants and alumni`);
  }

  // 3. Seed news
  const existingNews = await db.select().from(news);
  if (existingNews.length === 0) {
    const articles = [
      {
        id: 'news-1',
        title: 'The seal is broken.',
        content: 'Six new names begin a new TTPL chapter. Shannon Aurelia W., Alief Rizki F., Raudana M., Abdul Jafor M., Dominick Dexter G., and Naila Faiza are official batch 2024 active assistants.',
        tag: 'Announcement',
        createdAt: Date.now() - 3600000 * 24 * 5
      },
      {
        id: 'news-2',
        title: 'RL and IDP semester timeline.',
        content: 'RL starts with September pre-test, followed by October post-test. IDP continues through November and December. Review schedules carefully on the portal.',
        tag: 'Practicum',
        createdAt: Date.now() - 3600000 * 24 * 4
      },
      {
        id: 'news-3',
        title: 'TTPL YouTube hub.',
        content: 'Module videos connect to the official TTPL FTUI YouTube channel. Access lecture recordings, circuit setup instructions, and instrumentation tutorials directly.',
        tag: 'Resource',
        createdAt: Date.now() - 3600000 * 24 * 3
      },
      {
        id: 'news-4',
        title: 'Project-based TTPL.',
        content: 'A new section for clients and collaborators is now prepared. Connect with the laboratory for testing facilities, high-voltage calibrations, and instrument usage.',
        tag: 'Project',
        createdAt: Date.now() - 3600000 * 24 * 2
      },
      {
        id: 'news-5',
        title: 'Assistant archive updated.',
        content: 'Elektro 22 and Elektro 23 portraits are preserved separately from the current batch. Keep the history and legacy alive.',
        tag: 'Archive',
        createdAt: Date.now() - 3600000 * 24 * 1
      },
      {
        id: 'news-6',
        title: 'Student submission concept.',
        content: 'Tugas pendahuluan, lab reports, pre-test, and post-test checkpoints are prepared for the portal flow. Students can now submit digitally.',
        tag: 'Portal',
        createdAt: Date.now()
      }
    ];

    for (const article of articles) {
      await db.insert(news).values(article);
    }
    console.log('✔ Seeded 6 news articles');
  }

  console.log('Seeding completed successfully!');
}

main().catch((err) => {
  console.error('Error seeding database:', err);
  process.exit(1);
});
