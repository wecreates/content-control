#!/usr/bin/env python3
"""Run a validated ordered diagnostic without supplying missing task metadata."""
import argparse,json,subprocess,sys
from pathlib import Path

def select_task(queue,index):
 if not isinstance(queue,dict) or queue.get('publication_enabled') is not False or queue.get('status')!='READY' or queue.get('blockers') or queue.get('blocked_tasks'):
  raise ValueError('queue_not_ready')
 tasks=queue.get('tasks')
 if not isinstance(tasks,list) or type(index) is not int or index<0 or index>=len(tasks):raise ValueError('invalid_task_index')
 task=tasks[index]
 if not isinstance(task,dict) or task.get('publication_enabled') is not False or task.get('blockers') or type(task.get('capability_id')) is not int or task['capability_id']<=0 or any(not isinstance(task.get(k),str) or not task[k].strip() for k in ('domain','capability','group','current_state')):raise ValueError('task_metadata_missing_or_invalid')
 return task

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--queue',required=True);ap.add_argument('--index',type=int,required=True);ap.add_argument('--out',required=True);args=ap.parse_args()
 try:task=select_task(json.loads(Path(args.queue).read_text()),args.index)
 except (ValueError,OSError):
  out=Path(args.out);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps({'status':'BLOCKED','reason':'invalid_queue_or_task','completion_verified':False,'publication_enabled':False})+'\n');return 2
 return subprocess.run([sys.executable,'scripts/upgrade_and_test_capability.py','--task',json.dumps(task),'--out',args.out]).returncode
if __name__=='__main__':raise SystemExit(main())
