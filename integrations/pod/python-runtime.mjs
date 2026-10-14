import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
export async function checkPodPython(env=process.env){
 try{
  await promisify(execFile)(env.POD_PYTHON||'python3',['-c',
   "from PIL import Image; import reportlab; import fitz; import cv2; import numpy; import shutil; assert shutil.which('tesseract')"],
   {env,timeout:15000,maxBuffer:4096});
  return true;
 }catch{return false;}
}
