import { type Extractor, type OutputFormat, type ScrapingMode } from '../types';

export const generateSeleniumCode = (url: string): string => {
  return `from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import time

# --- Setup Instructions ---
# 1. Make sure you have Python installed.
# 2. Install required libraries:
#    pip install selenium webdriver-manager

# --- Script ---
# Initialize Chrome WebDriver
# webdriver-manager will automatically download the correct driver for your Chrome version.
try:
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()))
except Exception as e:
    print(f"Error setting up Chrome Driver: {e}")
    print("Please ensure Google Chrome is installed on your system.")
    exit()

# The URL to scrape
url = "${url}"

print(f"Opening URL: {url}")
driver.get(url)

# Wait for the page to load dynamically.
# Adjust the sleep time if the page needs more time to load all content.
print("Waiting for page to load (5 seconds)...")
time.sleep(5)

# Save the page source to an HTML file
file_name = "page.html"
try:
    with open(file_name, "w", encoding="utf-8") as f:
        f.write(driver.page_source)
    print(f"Successfully saved page HTML to '{file_name}'")
except Exception as e:
    print(f"Error saving file: {e}")

# Clean up and close the browser
driver.quit()
print("Browser closed.")
`;
};

const convertToCssSelector = (tag: string, attrs: string): string => {
    if (!tag.trim()) return '';
    let selector = tag.trim();
    if (!attrs.trim()) return selector;
    try {
        const parts = attrs.split(',').map(p => p.trim()).filter(p => p.includes('='));
        for (const part of parts) {
            const eqIndex = part.indexOf('=');
            let key = part.substring(0, eqIndex).trim();
            let value = part.substring(eqIndex + 1).trim();
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.substring(1, value.length - 1);
            }
            if (key && value) {
                if (key.toLowerCase() === 'id') selector += `#${value.split(/\s+/)[0]}`;
                else if (key.toLowerCase() === 'class') {
                    const classes = value.split(/\s+/).filter(Boolean).join('.');
                    if (classes) selector += `.${classes}`;
                } else selector += `[${key}="${value.replace(/"/g, '\\"')}"]`;
            }
        }
        return selector;
    } catch (e) {
        console.error("Error creating selector from attributes:", attrs, e);
        return tag.trim();
    }
};

const generateContainerBasedScript = (container: Omit<Extractor, 'id' | 'name'>, extractors: Extractor[], outputFormat: OutputFormat): string => {
    const containerSelector = convertToCssSelector(container.tag, container.attrs).replace(/"/g, '\\"');

    const extractionLoop = `
# Find all the container elements
container_selector = "${containerSelector}"
containers = soup.select(container_selector)
print(f"Found {len(containers)} containers.")

# --- Extract data from each container ---
all_items = []
for container in containers:
    item = {}
${extractors.map(e => {
    const fieldSelector = convertToCssSelector(e.tag, e.attrs).replace(/"/g, '\\"');
    return `    field_element = container.select_one("${fieldSelector}")
    item['${e.name}'] = field_element.get_text(strip=True) if field_element else None`
}).join('\n')}
    all_items.append(item)
`;

    let outputScript = '';
    switch (outputFormat) {
        case 'csv':
            return `
${extractionLoop}

# --- Save data to CSV ---
if all_items:
    csv_file_name = "output.csv"
    print(f"\\nSaving data to {csv_file_name}...")
    try:
        with open(csv_file_name, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=all_items[0].keys())
            writer.writeheader()
            writer.writerows(all_items)
        print("Data successfully saved to CSV.")
    except Exception as e:
        print(f"Error saving to CSV: {e}")
else:
    print("\\nNo data extracted to save.")
`;
        case 'json':
            return `
${extractionLoop}

# --- Save data to JSON ---
if all_items:
    json_file_name = "output.json"
    print(f"\\nSaving data to {json_file_name}...")
    try:
        with open(json_file_name, 'w', encoding='utf-8') as jsonfile:
            json.dump(all_items, jsonfile, indent=4)
        print("Data successfully saved to JSON.")
    except Exception as e:
        print(f"Error saving to JSON: {e}")
else:
    print("\\nNo data extracted to save.")
`;
        case 'print':
            return `
${extractionLoop}

# --- Print Extracted Data ---
print("\\n--- Extracted Data ---")
for item in all_items:
    print(item)
`;
    }
};

const generateSimpleListScript = (extractor: Extractor, outputFormat: OutputFormat): string => {
    const selector = convertToCssSelector(extractor.tag, extractor.attrs).replace(/"/g, '\\"');
    const extractionLogic = `
# Find all matching elements on the page
selector = "${selector}"
elements = soup.select(selector)
print(f"Found {len(elements)} matching elements.")

# Extract the text content from each element
extracted_data = [el.get_text(strip=True) for el in elements]
`;

    switch (outputFormat) {
        case 'csv':
            return `
${extractionLogic}

# --- Save data to CSV ---
if extracted_data:
    csv_file_name = "output.csv"
    print(f"\\nSaving data to {csv_file_name}...")
    try:
        with open(csv_file_name, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.writer(csvfile)
            writer.writerow(['${extractor.name}'])  # Header
            for item in extracted_data:
                writer.writerow([item])
        print("Data successfully saved to CSV.")
    except Exception as e:
        print(f"Error saving to CSV: {e}")
else:
    print("\\nNo data extracted to save.")
`;
        case 'json':
            return `
${extractionLogic}

# --- Save data to JSON ---
if extracted_data:
    json_file_name = "output.json"
    print(f"\\nSaving data to {json_file_name}...")
    try:
        # Saving as a list of strings under a single key
        output_json = {'${extractor.name}': extracted_data}
        with open(json_file_name, 'w', encoding='utf-8') as jsonfile:
            json.dump(output_json, jsonfile, indent=4)
        print("Data successfully saved to JSON.")
    except Exception as e:
        print(f"Error saving to JSON: {e}")
else:
    print("\\nNo data extracted to save.")
`;
        case 'print':
            return `
${extractionLogic}

# --- Print Extracted Data ---
print("\\n--- Extracted Data ---")
for item in extracted_data:
    print(item)
`;
    }
};

interface GenerateBsCodeParams {
    scrapingMode: ScrapingMode;
    container: Omit<Extractor, 'id' | 'name'>;
    extractors: Extractor[];
    fileName: string;
    outputFormat: OutputFormat;
}

export const generateBeautifulSoupCode = (params: GenerateBsCodeParams): string => {
    const { scrapingMode, container, extractors, fileName, outputFormat } = params;
    const sanitizedFileName = fileName.replace(/"/g, '\\"');
  
    if ((scrapingMode === 'structured' && (!container.tag || extractors.length === 0)) || (scrapingMode === 'simple' && !extractors[0]?.tag)) {
        return `# Please complete the definitions in Step 4 to generate the script.
# - For Structured Data, define a container and at least one field.
# - For a Simple List, define the single field you want to extract.`;
    }

    const imports = new Set<string>(['from bs4 import BeautifulSoup']);
    if (outputFormat === 'csv') imports.add('import csv');
    if (outputFormat === 'json') imports.add('import json');

    const mainScript = scrapingMode === 'structured'
        ? generateContainerBasedScript(container, extractors, outputFormat)
        : generateSimpleListScript(extractors[0], outputFormat);

    return `${Array.from(imports).join('\n')}

# --- Setup Instructions ---
# 1. Make sure you have Python installed.
# 2. Install required libraries:
#    pip install beautifulsoup4

# --- Script ---
file_name = "${sanitizedFileName}"

try:
    with open(file_name, "r", encoding="utf-8") as f:
        html_content = f.read()
except FileNotFoundError:
    print(f"Error: The file '{file_name}' was not found.")
    print("Please make sure it's in the same directory as this Python script.")
    exit()

soup = BeautifulSoup(html_content, "html.parser")
${mainScript}
`;
};
