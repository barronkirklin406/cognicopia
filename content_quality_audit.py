import asyncio
from playwright.async_api import async_playwright
import json
import os

async def audit_all_pages():
    html_files = [f for f in os.listdir(".") if f.endswith(".html")]
    master_audit = {}

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        for file_name in html_files:
            file_path = os.path.abspath(file_name)
            file_url = f"file:///{file_path.replace(os.sep, '/')}"
            
            print(f"Auditing page: {file_name}...")
            try:
                await page.goto(file_url, wait_until="load", timeout=5000)
            except Exception as e:
                print(f"Skipping {file_name} due to load error: {e}")
                continue

            page_data = {
                "title": await page.title(),
                "links": [],
                "buttons": [],
                "inputs_and_generators": [],
                "sample_text": []
            }

            # Gather all links
            links = await page.locator("a").all()
            for l in links:
                txt = await l.inner_text()
                href = await l.get_attribute("href")
                if txt.strip() or href:
                    page_data["links"].append({"text": txt.strip(), "href": href})

            # Gather all buttons
            buttons = await page.locator("button, input[type='button'], input[type='submit']").all()
            for b in buttons:
                txt = await b.inner_text()
                val = await b.get_attribute("value")
                page_data["buttons"].append({"text": txt.strip() or val or ""})

            # Gather inputs, selects, generators
            controls = await page.locator("select, input, textarea").all()
            for c in controls:
                c_type = await c.get_attribute("type") or "select/textarea"
                c_id = await c.get_attribute("id") or ""
                c_name = await c.get_attribute("name") or ""
                page_data["inputs_and_generators"].append({"type": c_type, "id": c_id, "name": c_name})

            # Gather sample text
            texts = await page.locator("h1, h2, h3, p").all()
            for t in texts[:20]:
                t_txt = await t.inner_text()
                if t_txt.strip():
                    page_data["sample_text"].append(t_txt.strip())

            master_audit[file_name] = page_data

        with open("full_site_audit_report.json", "w") as f:
            json.dump(master_audit, f, indent=2)

        await browser.close()
        print("Full site audit complete! Saved to full_site_audit_report.json")

asyncio.run(audit_all_pages())