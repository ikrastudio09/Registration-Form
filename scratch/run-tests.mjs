import fs from 'fs';
import path from 'path';

// Read constants/playerOptions.js content and extract values
const optionsFile = fs.readFileSync(path.resolve('./constants/playerOptions.js'), 'utf8');

// Quick evaluator for ES module constants in isolated VM context
import vm from 'vm';
const context = {};
// Strip export keywords
const scriptContent = optionsFile.replace(/export\s+const\s+/g, 'const ') + 
  '\ncontext.PROFESSIONS = PROFESSIONS;\ncontext.BLOOD_GROUPS = BLOOD_GROUPS;\ncontext.PLAYER_ROLES = PLAYER_ROLES;\ncontext.PLAYING_STYLES = PLAYING_STYLES;\ncontext.CLOTHING_SIZES = CLOTHING_SIZES;\ncontext.TSHIRT_NUMBER_MIN = TSHIRT_NUMBER_MIN;\ncontext.TSHIRT_NUMBER_MAX = TSHIRT_NUMBER_MAX;\ncontext.TSHIRT_NAME_MAX_LENGTH = TSHIRT_NAME_MAX_LENGTH;\ncontext.MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_BYTES;\ncontext.ALLOWED_IMAGE_TYPES = ALLOWED_IMAGE_TYPES;\n';

vm.runInNewContext(scriptContent, { context });
const {
  PROFESSIONS,
  BLOOD_GROUPS,
  PLAYER_ROLES,
  PLAYING_STYLES,
  CLOTHING_SIZES,
  TSHIRT_NUMBER_MIN,
  TSHIRT_NUMBER_MAX,
  TSHIRT_NAME_MAX_LENGTH,
  MAX_IMAGE_SIZE_BYTES,
  ALLOWED_IMAGE_TYPES,
} = context;

// Load and evaluate apiHelpers.js
const apiHelpersFile = fs.readFileSync(path.resolve('./utils/apiHelpers.js'), 'utf8');
const helpersContent = apiHelpersFile
  .replace(/import\s+[\s\S]*?from\s+['"].*?['"];?/g, '')
  .replace(/export\s+function\s+/g, 'function ')
  + '\ncontext.calculateAge = calculateAge;\ncontext.validateMobile = validateMobile;\ncontext.validateDate = validateDate;\ncontext.validateUploadedFile = validateUploadedFile;\ncontext.validateRequiredFields = validateRequiredFields;\n';

vm.runInNewContext(helpersContent, {
  context,
  BLOOD_GROUPS,
  PROFESSIONS,
  PLAYER_ROLES,
  PLAYING_STYLES,
  CLOTHING_SIZES,
  TSHIRT_NUMBER_MIN,
  TSHIRT_NUMBER_MAX,
  TSHIRT_NAME_MAX_LENGTH,
  MAX_IMAGE_SIZE_BYTES,
  ALLOWED_IMAGE_TYPES,
  Response: { json: (b, opts) => ({ body: b, ...opts }) }
});

const { calculateAge, validateMobile, validateDate, validateUploadedFile, validateRequiredFields } = context;

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${testName}`);
    failed++;
  }
}

console.log("\n========================================================");
console.log(" MHSPL 2026 - COMPREHENSIVE SYSTEM VERIFICATION TESTS");
console.log("========================================================");

console.log("\n[1] CONSTANTS & ENUMS VERIFICATION");
assert(PROFESSIONS.length === 41, `Predefined professions count is exactly 41 (got ${PROFESSIONS.length})`);
assert(PROFESSIONS[0] === "Software Developer", "Profession 1 is 'Software Developer'");
assert(PROFESSIONS[40] === "Other", "Profession 41 is 'Other'");
assert(PROFESSIONS.includes("Chartered Accountant (CA)"), "Profession list includes 'Chartered Accountant (CA)'");
assert(PROFESSIONS.includes("Turmeric (Haldi)"), "Profession list includes 'Turmeric (Haldi)'");
assert(PROFESSIONS.includes("Raisins"), "Profession list includes 'Raisins'");
assert(PROFESSIONS.includes("Jewellery / Gold & Silver"), "Profession list includes 'Jewellery / Gold & Silver'");
assert(PROFESSIONS.includes("Yoga & Zumba Trainer / Fitness & Nutrition Coach"), "Profession list includes Yoga Trainer");
assert(PROFESSIONS.includes("Astrology / Vastu Visharad"), "Profession list includes 'Astrology / Vastu Visharad'");

assert(BLOOD_GROUPS.length === 8, "Blood groups count is 8");
assert(
  JSON.stringify(BLOOD_GROUPS) === JSON.stringify(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]),
  "Blood groups match [A+, A-, B+, B-, AB+, AB-, O+, O-]",
);

assert(
  JSON.stringify(CLOTHING_SIZES) === JSON.stringify(["XS", "S", "M", "L", "XL", "XXL", "XXXL"]),
  "Clothing sizes match [XS, S, M, L, XL, XXL, XXXL]",
);

assert(
  JSON.stringify(PLAYER_ROLES) === JSON.stringify(["Batsman", "Bowler", "All Rounder"]),
  "Player roles match [Batsman, Bowler, All Rounder]",
);

assert(
  JSON.stringify(PLAYING_STYLES) ===
    JSON.stringify(["Right Arm Batting", "Right Arm Balling", "Left Arm Batting", "Left Arm Balling"]),
  "Playing styles match [Right Arm Batting, Right Arm Balling, Left Arm Batting, Left Arm Balling]",
);

assert(TSHIRT_NUMBER_MIN === 0 && TSHIRT_NUMBER_MAX === 99, "T-shirt number range is 0 to 99");
assert(TSHIRT_NAME_MAX_LENGTH === 20, "T-shirt name max length is 20");
assert(MAX_IMAGE_SIZE_BYTES === 3 * 1024 * 1024, "Max image upload size is 3 MB (3,145,728 bytes)");

console.log("\n[2] AGE CALCULATION & BACKWARD COMPATIBILITY");
const age2000 = calculateAge("2000-01-01");
assert(typeof age2000 === "number" && age2000 >= 24, `Age calculated correctly from DOB 2000-01-01 (result: ${age2000})`);

// Historical records fallback testing
assert(calculateAge(null, 32) === 32, "Historical record fallback to Age 32 when DOB is null");
assert(calculateAge(undefined, "29") === 29, "Historical record fallback to numeric string '29' as 29");
assert(calculateAge("", 45) === 45, "Historical record fallback when DOB is empty string");
assert(calculateAge(null, null) === null, "Returns null when both DOB and historical Age are missing");
assert(calculateAge("invalid-date", 30) === 30, "Returns historical Age 30 when DOB string is invalid");

console.log("\n[3] MOBILE NUMBER VALIDATION");
assert(validateMobile("9876543210") === true, "Valid 10-digit mobile starting with 9");
assert(validateMobile("8765432109") === true, "Valid 10-digit mobile starting with 8");
assert(validateMobile("7654321098") === true, "Valid 10-digit mobile starting with 7");
assert(validateMobile("6543210987") === true, "Valid 10-digit mobile starting with 6");
assert(validateMobile("5432109876") === false, "Rejects mobile starting with 5");
assert(validateMobile("987654321") === false, "Rejects 9-digit mobile");
assert(validateMobile("98765432101") === false, "Rejects 11-digit mobile");
assert(validateMobile("98765abcde") === false, "Rejects non-numeric mobile");
assert(validateMobile("") === false, "Rejects empty mobile");

console.log("\n[4] DATE VALIDATION (DOB & ANNIVERSARY)");
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 2);
const tomorrowStr = tomorrow.toISOString().split("T")[0];

assert(validateDate(tomorrowStr, { required: true, allowFuture: false }) !== null, "Rejects future Date of Birth");
assert(validateDate("2000-05-20", { required: true, allowFuture: false }) === null, "Accepts past Date of Birth");
assert(validateDate("", { required: true }) !== null, "Rejects missing Date of Birth");
assert(validateDate("", { required: false }) === null, "Accepts omitted Anniversary date");
assert(validateDate("not-a-date", { required: true }) !== null, "Rejects invalid date string");

console.log("\n[5] FILE VALIDATION (3MB LIMIT & FORMATS)");
const validJpg = { name: "portrait.jpg", type: "image/jpeg", size: 2.5 * 1024 * 1024 };
const validWebp = { name: "payment.webp", type: "image/webp", size: 1.2 * 1024 * 1024 };
const validPng = { name: "id.png", type: "image/png", size: 500 * 1024 };
const oversized = { name: "large.jpg", type: "image/jpeg", size: 3.5 * 1024 * 1024 };
const zeroByte = { name: "corrupt.jpg", type: "image/jpeg", size: 0 };
const pdfFile = { name: "doc.pdf", type: "application/pdf", size: 1024 * 1024 };

assert(validateUploadedFile(validJpg, "Player photo") === null, "Valid 2.5MB JPEG accepted");
assert(validateUploadedFile(validWebp, "Payment screenshot") === null, "Valid 1.2MB WebP accepted");
assert(validateUploadedFile(validPng, "Player photo") === null, "Valid PNG accepted");
assert(validateUploadedFile(oversized, "Player photo") !== null, "Oversized 3.5MB file rejected (>3MB)");
assert(validateUploadedFile(zeroByte, "Player photo") !== null, "0-byte empty file rejected");
assert(validateUploadedFile(pdfFile, "Player photo") !== null, "Non-image PDF file rejected");
assert(validateUploadedFile(null, "Player photo", { required: true }) !== null, "Missing required file rejected");

console.log("\n[6] REQUIRED FIELDS VALIDATION");
const completeBody = {
  name: "Virat Kohli",
  mobile: "9876543210",
  dateOfBirth: "1988-11-05",
  bloodGroup: "B+",
  fatherName: "Prem Kohli",
  motherName: "Saroj Kohli",
  profession: "Software Developer",
  role: "Batsman",
  transactionId: "TXN12345678",
  tShirtSize: "L",
  pantSize: "L",
  tShirtNumber: 18,
  tShirtName: "KOHLI",
  addressLine1: "102 Cricket Villa",
  city: "Sangli",
  state: "Maharashtra",
  pinCode: "416416",
};
assert(
  validateRequiredFields(completeBody, Object.keys(completeBody)) === null,
  "All required fields including address present returns null",
);

const missingBody = { ...completeBody, bloodGroup: "" };
assert(
  validateRequiredFields(missingBody, Object.keys(completeBody)) !== null,
  "Missing bloodGroup correctly detected",
);

const missingAddress = { ...completeBody, addressLine1: "" };
assert(
  validateRequiredFields(missingAddress, Object.keys(completeBody)) !== null,
  "Missing addressLine1 correctly detected",
);

console.log("\n========================================================");
console.log(` SUMMARY: ${passed} Passed, ${failed} Failed`);
console.log("========================================================\n");

if (failed > 0) process.exit(1);
