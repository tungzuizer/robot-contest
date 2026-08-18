const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    console.log("Starting Puppeteer Audit...");
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    const errorsReport = [];
    const consoleLogsReport = [];
    const networkErrorsReport = [];

    page.on('console', msg => {
        const text = msg.text();
        const type = msg.type();
        if (type === 'error' || type === 'warning' || text.includes('Error') || text.includes('Uncaught')) {
            consoleLogsReport.push({ type, text, location: msg.location() });
        }
    });

    page.on('pageerror', err => {
        errorsReport.push({ type: 'uncaught_exception', message: err.message, stack: err.stack });
    });

    page.on('response', response => {
        if (response.status() >= 400) {
            networkErrorsReport.push({
                url: response.url(),
                status: response.status(),
                statusText: response.statusText()
            });
        }
    });

    page.on('requestfailed', request => {
        networkErrorsReport.push({
            url: request.url(),
            failure: request.failure() ? request.failure().errorText : 'Failed'
        });
    });

    console.log("Navigating to app...");
    await page.goto('https://school-management-red-one.vercel.app', { waitUntil: 'networkidle2' });

    // Extract all demo login buttons
    const demoButtons = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
        return btns.map(b => ({
            text: b.innerText.trim(),
            className: b.className
        })).filter(b => b.text.includes('Hiệu trưởng') || b.text.includes('Phó Hiệu trưởng') || b.text.includes('Giáo viên') || b.text.includes('Học sinh'));
    });

    console.log("Demo buttons found:", demoButtons);

    const rolesToTest = ['Hiệu trưởng', 'Phó Hiệu trưởng', 'Giáo viên', 'Học sinh'];
    const auditResults = {};

    for (const role of rolesToTest) {
        console.log(`\n========================================`);
        console.log(`TESTING ROLE: ${role}`);
        console.log(`========================================`);

        auditResults[role] = {
            consoleErrors: [],
            uncaughtErrors: [],
            networkErrors: [],
            visitedPages: []
        };

        // Go to login page
        await page.goto('https://school-management-red-one.vercel.app', { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 1000));

        // Click demo login button for role
        const clicked = await page.evaluate((roleName) => {
            const btns = Array.from(document.querySelectorAll('button'));
            const target = btns.find(b => b.innerText && b.innerText.includes(roleName));
            if (target) {
                target.click();
                return true;
            }
            return false;
        }, role);

        if (!clicked) {
            console.log(`Failed to find demo login button for ${role}`);
            continue;
        }

        await new Promise(r => setTimeout(r, 1500));

        // Check if there is a submit button ("Đăng nhập") that needs to be clicked after demo account fill, or if demo button auto logs in
        const submitClicked = await page.evaluate(() => {
            const loginBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText && (b.innerText.trim() === 'Đăng nhập' || b.innerText.includes('Đăng Nhập')));
            if (loginBtn && !loginBtn.disabled) {
                loginBtn.click();
                return true;
            }
            return false;
        });
        console.log(`Submitted login form: ${submitClicked}`);

        await new Promise(r => setTimeout(r, 3000));
        console.log(`Logged in as ${role}. Current URL: ${page.url()}`);

        // Get all menu items on sidebar
        const menuItems = await page.evaluate(() => {
            const sidebar = document.querySelector('aside, nav, div.sidebar') || document.body;
            // find clickable menu elements
            const elements = Array.from(sidebar.querySelectorAll('a, button, li, div[class*="menu"], div[class*="nav"], div[class*="item"]'));
            return elements.map(el => ({
                text: el.innerText ? el.innerText.trim().split('\n')[0] : '',
                href: el.getAttribute('href') || el.getAttribute('to') || null,
                tagName: el.tagName
            })).filter(e => e.text && e.text.length > 1 && !e.text.includes('Quản lý Trường học'));
        });

        console.log(`Found ${menuItems.length} potential menu items for ${role}:`, menuItems.map(m => m.text));

        // Get distinct sidebar links
        const navLinks = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a[href]'));
            return links.map(l => ({
                text: l.innerText.trim(),
                href: l.href
            })).filter(l => l.text && !l.href.endsWith('#'));
        });

        // Click through sidebar links / buttons
        const sidebarButtons = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('aside a, aside button, nav a, nav button, div[class*="sidebar"] a, div[class*="sidebar"] button'));
            return btns.map((b, idx) => ({
                idx,
                text: b.innerText.trim().replace(/\n/g, ' '),
                tagName: b.tagName
            }));
        });

        console.log(`Found ${sidebarButtons.length} sidebar buttons:`, sidebarButtons);

        for (let i = 0; i < sidebarButtons.length; i++) {
            const item = sidebarButtons[i];
            if (!item.text || item.text.includes('Đăng xuất')) continue;

            console.log(`Clicking menu item [${i}]: ${item.text}`);
            
            // Clear current logs collectors for individual page tracking
            const initialConsoleLen = consoleLogsReport.length;
            const initialPageErrLen = errorsReport.length;
            const initialNetErrLen = networkErrorsReport.length;

            const currentUrlBefore = page.url();

            try {
                await page.evaluate((index) => {
                    const btns = Array.from(document.querySelectorAll('aside a, aside button, nav a, nav button, div[class*="sidebar"] a, div[class*="sidebar"] button'));
                    if (btns[index]) btns[index].click();
                }, i);

                await new Promise(r => setTimeout(r, 2000));
            } catch (err) {
                console.log(`Error clicking item ${item.text}:`, err.message);
            }

            const currentUrlAfter = page.url();
            console.log(`   Result URL: ${currentUrlAfter}`);

            // Collect sub-tabs on current page if any
            const pageTabs = await page.evaluate(() => {
                const tabs = Array.from(document.querySelectorAll('button[role="tab"], div[role="tab"], div[class*="tab"]'));
                return tabs.map((t, idx) => ({ idx, text: t.innerText.trim() })).filter(t => t.text.length > 0 && t.text.length < 30);
            });

            if (pageTabs.length > 0) {
                console.log(`   Found ${pageTabs.length} subtabs on page:`, pageTabs.map(t => t.text));
                for (let tIdx = 0; tIdx < pageTabs.length; tIdx++) {
                    try {
                        await page.evaluate((tabIndex) => {
                            const tabs = Array.from(document.querySelectorAll('button[role="tab"], div[role="tab"], div[class*="tab"]'));
                            if (tabs[tabIndex]) tabs[tabIndex].click();
                        }, tIdx);
                        await new Promise(r => setTimeout(r, 1000));
                    } catch (e) {}
                }
            }

            const newConsole = consoleLogsReport.slice(initialConsoleLen);
            const newPageErr = errorsReport.slice(initialPageErrLen);
            const newNetErr = networkErrorsReport.slice(initialNetErrLen);

            auditResults[role].visitedPages.push({
                menuText: item.text,
                url: currentUrlAfter,
                consoleLogs: newConsole,
                uncaughtErrors: newPageErr,
                networkErrors: newNetErr
            });
        }

        // Test logout
        console.log(`Logging out from ${role}...`);
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button, a, div'));
            const logoutBtn = btns.find(b => b.innerText && b.innerText.includes('Đăng xuất'));
            if (logoutBtn) logoutBtn.click();
        });
        await new Promise(r => setTimeout(r, 2000));
    }

    await browser.close();

    const summaryReport = {
        allConsoleErrors: consoleLogsReport,
        allUncaughtExceptions: errorsReport,
        allNetworkErrors: networkErrorsReport,
        resultsByRole: auditResults
    };

    fs.writeFileSync('C:/Users/tungh/Desktop/audit_report.json', JSON.stringify(summaryReport, null, 2));
    console.log("\nAudit finished! Report saved to audit_report.json");
})();
