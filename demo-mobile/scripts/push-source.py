# One-shot authenticated Git publisher. Credential is read without terminal echo and held in memory.
import json,os,subprocess,sys,termios
fd=sys.stdin.fileno();settings=termios.tcgetattr(fd);hidden=list(settings);hidden[3]&=~termios.ECHO;termios.tcsetattr(fd,termios.TCSANOW,hidden)
print('Ready for credential JSON on stdin (hidden).',flush=True)
try: data=json.loads(sys.stdin.readline())
finally: termios.tcsetattr(fd,termios.TCSANOW,settings)
c=data['credential'];env=os.environ.copy()
for key in list(env):
 if key.startswith('GIT_TRACE') or key=='GIT_CURL_VERBOSE': env.pop(key)
env.update({'GIT_CONFIG_COUNT':'1','GIT_CONFIG_KEY_0':'http.extraHeader','GIT_CONFIG_VALUE_0':'Authorization: Bearer '+c['token'],'GIT_TERMINAL_PROMPT':'0'})
def run(args,authenticated=False):
 result=subprocess.run(args,env=env if authenticated else None,capture_output=True,text=True)
 if result.returncode:
  print((result.stderr or result.stdout).replace(c['token'],'[REDACTED]'),flush=True);sys.exit(result.returncode)
 return result.stdout.strip()
if not os.path.isdir('.git'):run(['git','init','-b',c['branch']])
run(['git','config','user.name','Convergence demo'])
run(['git','config','user.email','demo@localhost'])
remotes=run(['git','remote']).splitlines()
run(['git','remote','set-url' if 'origin' in remotes else 'add','origin',c['remote_url']])
run(['git','add','.'])
if run(['git','status','--porcelain']):run(['git','commit','-m','Publish private synthetic mobile demonstration'])
run(['git','push','--set-upstream','origin',c['branch']],True)
print(json.dumps({'commit_sha':run(['git','rev-parse','HEAD']),'project_id':data['project_id'],'pushed':True}),flush=True)
