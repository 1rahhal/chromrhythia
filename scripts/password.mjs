import {createInterface} from 'node:readline';
import {mkdir,writeFile} from 'node:fs/promises';
import {buildSite} from './build.mjs';
// Hidden terminal input. The password never appears in command arguments or logs.
if(!process.stdin.isTTY)throw Error('Run npm run password in an interactive terminal, or supply GAME_PASSWORD through your hosting secret manager.');
async function hidden(prompt){process.stdout.write(prompt);process.stdin.setRawMode(true);process.stdin.resume();let value='';return new Promise((resolve,reject)=>{const listener=chunk=>{for(const c of chunk.toString()){if(c==='\r'||c==='\n'){process.stdin.off('data',listener);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');resolve(value);return}if(c==='\u0003'){process.stdin.setRawMode(false);process.exit(130)}if(c==='\u007f'||c==='\b')value=value.slice(0,-1);else value+=c}};process.stdin.on('data',listener)})}
const a=await hidden('New game password (12+ characters): '),b=await hidden('Confirm password: ');if(a!==b)throw Error('Passwords did not match');if(a.length<12)throw Error('Use at least 12 characters');await mkdir('.local',{recursive:true});await writeFile('.local/access-key.txt',a+'\n',{mode:0o600});await buildSite();console.log('Password updated. Deploy the new dist folder to update your hosted game.');
