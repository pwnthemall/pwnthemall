import { test, expect, Page } from '@playwright/test';

function getCookieHeader(response: any): string {
  const setCookieHeader = response.headers()['set-cookie'];
  if (setCookieHeader) {
    const cookiePairs = setCookieHeader.split(',').map((cookie: string) => {
      const [nameValue] = cookie.trim().split(';');
      return nameValue;
    }).filter(Boolean);
    return cookiePairs.join('; ');
  }
  return '';
}

test.describe('Submissions', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(180000);

  test('Add teams and submissions', async ({ page }) => {
  const teams = [
    {
      name: 'NHM2I',
      password: 'NHM2IPass123',
      solveRate: 0.80,
      members: [
        { username: 'nhm2i_alice', email: 'alice@nhm2i.team', password: 'AlicePass123' },
        { username: 'nhm2i_bob', email: 'bob@nhm2i.team', password: 'BobPass123' },
        { username: 'nhm2i_charlie', email: 'charlie@nhm2i.team', password: 'CharliePass123' }
      ]
    },
    {
      name: 'HIP',
      password: 'HIPPass456',
      solveRate: 0.60,
      members: [
        { username: 'hip_david', email: 'david@hip.team', password: 'DavidPass123' },
        { username: 'hip_eve', email: 'eve@hip.team', password: 'EvePass123' }
      ]
    },
    {
      name: 'SECSEA',
      password: 'SECSEAPass789',
      solveRate: 0.90,
      members: [
        { username: 'secsea_frank', email: 'frank@secsea.team', password: 'FrankPass123' },
        { username: 'secsea_grace', email: 'grace@secsea.team', password: 'GracePass123' },
        { username: 'secsea_henry', email: 'henry@secsea.team', password: 'HenryPass123' },
        { username: 'secsea_iris', email: 'iris@secsea.team', password: 'IrisPass123' }
      ]
    },
    {
      name: 'HTB',
      password: 'HTBPass321',
      solveRate: 0.40,
      members: [
        { username: 'htb_jack', email: 'jack@htb.team', password: 'JackPass123' },
        { username: 'htb_kate', email: 'kate@htb.team', password: 'KatePass123' }
      ]
    },
    {
      name: 'NLVP',
      password: 'NLVPPass654',
      solveRate: 0.70,
      members: [
        { username: 'nlvp_leo', email: 'leo@nlvp.team', password: 'LeoPass123' },
        { username: 'nlvp_mia', email: 'mia@nlvp.team', password: 'MiaPass123' },
        { username: 'nlvp_noah', email: 'noah@nlvp.team', password: 'NoahPass123' }
      ]
    }
  ];

  const wrongFlags = [
    '123',
    '547',
    'NON',
    'blabla'
  ];

  for (const team of teams) {
    let creatorCookie = '';
    
    const creator = team.members[0];
    const registerResp = await page.request.post('https://pwnthemall.local/api/register', {
      data: {
        username: creator.username,
        email: creator.email,
        password: creator.password
      }
    });

    if (!registerResp.ok()) {
      const errorText = await registerResp.text();
      if (!errorText.includes('already exists')) {
        continue;
      }
    }

    const loginResp = await page.request.post('https://pwnthemall.local/api/login', {
      data: {
        username: creator.email,
        password: creator.password
      }
    });

    if (!loginResp.ok()) {
      continue;
    }

    creatorCookie = getCookieHeader(loginResp);

    await page.request.post('https://pwnthemall.local/api/teams', {
      data: {
        name: team.name,
        password: team.password
      },
      headers: { 'Cookie': creatorCookie }
    });

    await page.request.post('https://pwnthemall.local/api/logout', {
      headers: { 'Cookie': creatorCookie }
    });

    for (let i = 1; i < team.members.length; i++) {
      const member = team.members[i];

      await page.request.post('https://pwnthemall.local/api/register', {
        data: {
          username: member.username,
          email: member.email,
          password: member.password
        }
      });

      const memberLoginResp = await page.request.post('https://pwnthemall.local/api/login', {
        data: {
          username: member.email,
          password: member.password
        }
      });

      if (!memberLoginResp.ok()) continue;

      const memberCookie = getCookieHeader(memberLoginResp);

      await page.request.post('https://pwnthemall.local/api/teams/join', {
        data: {
          name: team.name,
          password: team.password
        },
        headers: { 'Cookie': memberCookie }
      });

      await page.request.post('https://pwnthemall.local/api/logout', {
        headers: { 'Cookie': memberCookie }
      });
    }
  }

  const firstUser = teams[0].members[0];
  const challengeLoginResp = await page.request.post('https://pwnthemall.local/api/login', {
    data: {
      username: firstUser.email,
      password: firstUser.password
    }
  });

  const challengeCookie = getCookieHeader(challengeLoginResp);
  
  // Fetch challenges from all categories to get type information
  const categories = ['pwn', 'web', 'crypto', 'misc', 'forensics', 'rev'];
  let challenges: any[] = [];
  
  for (const category of categories) {
    const catResp = await page.request.get(`https://pwnthemall.local/api/challenges/category/${category}`, {
      headers: { 'Cookie': challengeCookie }
    });
    
    if (catResp.ok()) {
      const catChallenges = await catResp.json();
      if (Array.isArray(catChallenges)) {
        challenges = challenges.concat(catChallenges);
      }
    }
  }

  await page.request.post('https://pwnthemall.local/api/logout', {
    headers: { 'Cookie': challengeCookie }
  });

  console.log(`Found ${challenges.length} challenges`);
  
  if (challenges.length === 0) {
    throw new Error('No challenges found in database. Please seed challenges before running this test.');
  }
  
  for (const team of teams) {
    const numToSolve = Math.floor(challenges.length * team.solveRate);
    
    for (let i = 0; i < numToSolve; i++) {
      const challenge = challenges[i];
      
      const randomMember = team.members[Math.floor(Math.random() * team.members.length)];
      
      const loginResp = await page.request.post('https://pwnthemall.local/api/login', {
        data: {
          username: randomMember.email,
          password: randomMember.password
        }
      });

      const cookie = getCookieHeader(loginResp);
      
      const numWrongAttempts = 2 + Math.floor(Math.random() * 3);
      for (let w = 0; w < numWrongAttempts; w++) {
        await page.request.post(`https://pwnthemall.local/api/challenges/${challenge.id}/submit`, {
          data: { flag: wrongFlags[Math.floor(Math.random() * wrongFlags.length)] },
          headers: { 'Cookie': cookie }
        });
      }
      
      // Submit the correct flag (all challenges use "flag" as the flag value)
      await page.request.post(`https://pwnthemall.local/api/challenges/${challenge.id}/submit`, {
        data: { flag: 'flag' },
        headers: { 'Cookie': cookie }
      });
      
      await page.request.post('https://pwnthemall.local/api/logout', {
        headers: { 'Cookie': cookie }
      });
    }
    
    const randomMember = team.members[Math.floor(Math.random() * team.members.length)];
    const noiseLoginResp = await page.request.post('https://pwnthemall.local/api/login', {
      data: {
        username: randomMember.email,
        password: randomMember.password
      }
    });
    const noiseCookie = getCookieHeader(noiseLoginResp);
    
    const numNoiseAttempts = 5 + Math.floor(Math.random() * 6);
    for (let n = 0; n < numNoiseAttempts; n++) {
      const randomChallenge = challenges[numToSolve + Math.floor(Math.random() * (challenges.length - numToSolve))];
      if (randomChallenge) {
        await page.request.post(`https://pwnthemall.local/api/challenges/${randomChallenge.id}/submit`, {
          data: { flag: wrongFlags[Math.floor(Math.random() * wrongFlags.length)] },
          headers: { 'Cookie': noiseCookie }
        });
      }
    }
    
    await page.request.post('https://pwnthemall.local/api/logout', {
      headers: { 'Cookie': noiseCookie }
    });
  }

  // Start docker/compose challenge instances for teams
  console.log('\n=== Starting Docker Challenge Instances ===');
  const dockerChallenges = challenges.filter((c: any) => 
    c.challengeType?.name === 'docker' || c.challengeType?.name === 'compose'
  );

  if (dockerChallenges.length > 0) {
    console.log(`Found ${dockerChallenges.length} docker/compose challenges`);
    
    // Start instances for all teams (to create more variety and handle parallel workers)
    const teamsForInstances = teams;
    
    for (const team of teamsForInstances) {
      const member = team.members[0];
      
      const loginResp = await page.request.post('https://pwnthemall.local/api/login', {
        data: {
          username: member.email,
          password: member.password
        }
      });

      if (!loginResp.ok()) {
        console.log(`Failed to login as ${member.email}, skipping instances`);
        continue;
      }

      const cookie = getCookieHeader(loginResp);
      
      // Select 3 random docker challenges per team (increased from 2)
      const numInstances = Math.min(3, dockerChallenges.length);
      const selectedChallenges = [...dockerChallenges]
        .sort(() => Math.random() - 0.5)
        .slice(0, numInstances);
      
      console.log(`Starting ${numInstances} instances for team ${team.name}`);
      
      for (const challenge of selectedChallenges) {
        try {
          const instanceResp = await page.request.post(
            `https://pwnthemall.local/api/challenges/${challenge.id}/start`,
            {
              headers: { 'Cookie': cookie }
            }
          );

          if (instanceResp.ok()) {
            const instanceData = await instanceResp.json();
            
            // Check if instance was actually started or already existed
            if (instanceData.status === 'instance_already_running') {
              console.log(`  ⚠ ${challenge.name}: Already running (skipped)`);
            } else if (instanceData.status === 'instance_started') {
              console.log(`  ✓ Started instance: ${challenge.name} (ID: ${instanceData.id || 'N/A'})`);
            } else {
              console.log(`  ℹ ${challenge.name}: ${instanceData.status || 'Unknown status'}`);
            }
          } else {
            const errorText = await instanceResp.text();
            // Handle both old and new error formats
            if (errorText.includes('cooldown')) {
              console.log(`  ⚠ ${challenge.name}: Cooldown active (skipped)`);
            } else if (errorText.includes('instance_already_running')) {
              console.log(`  ⚠ ${challenge.name}: Already running (skipped)`);
            } else {
              console.log(`  ✗ Failed: ${challenge.name}: ${errorText}`);
            }
          }
          
          await page.waitForTimeout(1000);
          
        } catch (err) {
          console.log(`  ✗ Error starting ${challenge.name}:`, err);
        }
      }
      
      await page.request.post('https://pwnthemall.local/api/logout', {
        headers: { 'Cookie': cookie }
      });
      
      await page.waitForTimeout(1500);
    }
    
    console.log('Finished starting docker challenge instances\n');
  } else {
    console.log('No docker/compose challenges found, skipping instance creation\n');
  }

  });
});
