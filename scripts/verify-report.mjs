import {readFile} from 'node:fs/promises';
import {verifyReport} from '../dist/audit.mjs';
const [path,expectedDigest]=process.argv.slice(2);
if(!path){console.error('Usage: node scripts/verify-report.mjs <session.json> [separately-retained-sha256]');process.exitCode=2;}
else {try {const valid=await verifyReport(JSON.parse(await readFile(path,'utf8')),expectedDigest);console.log(valid?'Integrity verified (not proof of authorship).':'Integrity verification FAILED.');process.exitCode=valid?0:1;}catch(e){console.error(e.message);process.exitCode=1;}}
