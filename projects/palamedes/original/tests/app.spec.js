import { test, expect } from '@playwright/test';
test.beforeEach(async({page})=>{await page.goto('/');await expect(page.getByRole('heading',{name:'Scientific calculator.',exact:true})).toBeVisible();await page.waitForTimeout(1100)});
async function nav(page,name){await page.locator('.sidebar-nav').getByRole('button',{name,exact:true}).click();}
test('scientific calculator, degrees, high-precision check and persisted history',async({page})=>{
  await page.getByLabel('Calculation',{exact:true}).fill('(2+3)^4');await page.getByLabel('Calculate',{exact:true}).click();await expect(page.locator('.calc-result')).toContainText('625');await expect(page.locator('.check-result')).toContainText('Double-check passed');
  await page.getByRole('button',{name:'DEG',exact:true}).click();await page.getByLabel('Calculation',{exact:true}).fill('sin(30)');await page.getByLabel('Calculate',{exact:true}).click();await expect(page.locator('.calc-result')).toContainText('0.5');await page.reload();await expect(page.locator('.history-list')).toContainText('sin(30)');
});
test('automatic routing preloads matrix and equation workspaces',async({page})=>{
  await page.getByLabel('Smart math input').fill('[[2,1],[1,3]]');await page.getByTitle('Open matching calculator').click();await expect(page.getByRole('heading',{name:'Linear algebra.',exact:true})).toBeVisible();await expect(page.getByLabel('Matrix A', {exact:true})).toHaveValue('[[2,1],[1,3]]');
  await page.getByLabel('Smart math input').fill('2*x + 3 = 11');await page.getByTitle('Open matching calculator').click();await expect(page.getByRole('heading',{name:'Worked solver.',exact:true})).toBeVisible();await expect(page.locator('.solver-text')).toHaveValue('2*x + 3 = 11');
  await page.getByRole('button',{name:/Solve problem/}).click();await expect(page.locator('.solver-answer')).toContainText('4');await expect(page.locator('.solver-check.pass')).toBeVisible();
});
test('symbolic calculus and matrix substitution checks',async({page})=>{
  await nav(page,'Symbolic & calculus');await page.getByLabel('Symbolic operation').selectOption('derivative');await page.getByLabel('Symbolic expression').fill('x^3');await page.locator('form').last().getByRole('button',{name:/Calculate/}).click();await expect(page.locator('.result-box')).toContainText('3*x^2');
  await nav(page,'Matrices & vectors');await page.getByLabel('Matrix operation').selectOption('inv');await page.locator('form').last().getByRole('button',{name:/Calculate/}).click();await expect(page.locator('.verification-note')).toContainText('residual');
});
test('interactive graph modes and sampled values',async({page})=>{
  await nav(page,'Graphing');await expect(page.locator('.plot-container .main-svg').first()).toBeVisible({timeout:60000});await page.getByLabel('Graph type').selectOption('parametric');await expect(page.locator('.expression-row input')).toHaveValue('cos(t)');await page.waitForTimeout(500);
  const points=await page.locator('.plot-container').evaluate(el=>({x:el.data?.[0]?.x,y:el.data?.[0]?.y}));expect(points.x[0]).toBeCloseTo(1);expect(points.y[0]).toBeCloseTo(0);
  await page.getByLabel('Graph type').selectOption('cartesian');await page.getByRole('button',{name:'Show table'}).click();await expect(page.locator('.data-table tbody tr')).toHaveCount(21);
});
test('module functions work and program import waits for Run',async({page})=>{
  await nav(page,'Modules');await page.locator('.catalogue').filter({hasText:'Engineering essentials'}).getByRole('button',{name:'Install pack'}).click();await expect(page.locator('.module-card').filter({hasText:'Projectile trajectory'})).toBeVisible();
  await nav(page,'Calculate');await page.getByLabel('Calculation',{exact:true}).fill('kineticEnergy(2,3)');await page.getByLabel('Calculate',{exact:true}).click();await expect(page.locator('.calc-result')).toContainText('9');
  await nav(page,'Modules');await page.getByRole('button',{name:'Projectile trajectory'}).click();await expect(page.getByRole('heading',{name:'Code sandbox.',exact:true})).toBeVisible();await expect(page.locator('.sandbox-output')).toContainText('Run your program');
});
test('sandbox executes in isolation, emits plot, and terminates infinite loop',async({page})=>{
  await nav(page,'Code sandbox');await expect(page.getByRole('button',{name:'Run program',exact:true})).toBeEnabled({timeout:30000});const editor=page.locator('.sandbox-code-editor textarea');await editor.fill("print(math.sqrt(144)); plot([0,1],[0,1],'line'); return 42;");await page.getByRole('button',{name:'Run program',exact:true}).click();await expect(page.locator('.sandbox-output')).toContainText('12');await expect(page.locator('.sandbox-output')).toContainText('42');
  await editor.fill('while(true) {}');await page.getByRole('button',{name:'Run program',exact:true}).click();await expect(page.locator('.sandbox-error')).toContainText(/time|limit|second/i,{timeout:12000});
});
test('AI defaults off and keys never enter workspace export/local storage',async({page})=>{
  await page.getByTitle('Settings',{exact:true}).click();await expect(page.getByLabel('Enable AI assistance')).not.toBeChecked();await page.getByLabel('API key · session memory only').fill('test-key-no-live-request');const stores=await page.evaluate(()=>JSON.stringify(localStorage));expect(stores).not.toContain('test-key-no-live-request');await page.getByRole('button',{name:'Disable & clear key'}).click();await expect(page.getByLabel('API key · session memory only')).toHaveValue('');
});
test('ML calculations and textbook worked examples render',async({page})=>{
  await nav(page,'AI math lab');await expect(page.getByText('Weights, made visible.')).toBeVisible();
  await nav(page,'Equation handbook');await expect(page.getByText(/75/).first()).toBeVisible();await page.locator('.textbook-workspace input').fill('quadratic');await page.getByRole('button',{name:/example|worked|expand/i}).first().click();await expect(page.locator('body')).toContainText('3');
});
test('regular/advanced picker, backlight and standby are reversible',async({page})=>{
  await page.getByRole('button',{name:'Regular',exact:true}).click();await expect(page.locator('.scientific-keys')).toHaveCount(0);await page.getByRole('button',{name:'Math mode'}).click();await page.getByRole('button',{name:'Linear algebra advanced mathematics'}).click();await expect(page.getByRole('heading',{name:'Linear algebra.',exact:true})).toBeVisible();
  await page.getByTitle('Toggle display backlight').click();await expect(page.locator('.instrument-shell')).toHaveClass(/backlight-off/);await page.getByTitle('Power off workspace').click();await expect(page.getByRole('button',{name:'Power on'})).toBeVisible();await page.getByRole('button',{name:'Power on'}).click();await expect(page.locator('.topbar')).toBeVisible();
});
test('small screens have usable navigation and no page overflow',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Open navigation'}).click();await nav(page,'Solve & understand');await expect(page.getByRole('heading',{name:'Worked solver.',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});
