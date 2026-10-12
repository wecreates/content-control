"""Read-only Meta SDK probe. No browser credentials, publishing, or retries."""
import argparse,datetime,json,os,re
from pathlib import Path

def probe(env, api_factory=None):
 result={'provider':'meta_business_sdk','sdk_version':'26.0.2','route':'instagram_api_with_facebook_login','connected':False,'publication_enabled':False,'full_analysis':False,'checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'Authorized professional account identity and one bounded media metadata page; not arbitrary reel access or audiovisual analysis'}
 missing=[key for key in ('INSTAGRAM_ACCESS_TOKEN','INSTAGRAM_USER_ID') if not env.get(key)]
 if missing:return {**result,'status':'BLOCKED','reason':'authorization_missing','missing_configuration':missing}
 if not re.fullmatch(r'[0-9]{1,40}',env['INSTAGRAM_USER_ID']):return {**result,'status':'BLOCKED','reason':'invalid_account_id'}
 if env.get('PUBLICATION_ENABLED','false').lower()!='false':return {**result,'status':'BLOCKED','reason':'publication_must_remain_disabled'}
 try:
  if api_factory is None:
   from facebook_business.api import FacebookAdsApi
   from facebook_business.session import FacebookSession
   session=FacebookSession(access_token=env['INSTAGRAM_ACCESS_TOKEN'],app_secret=env.get('META_APP_SECRET'),timeout=20)
   api=FacebookAdsApi(session,api_version='v26.0',enable_debug_logger=False)
  else:api=api_factory()
  uid=env['INSTAGRAM_USER_ID']
  identity=api.call('GET',(uid,),params={'fields':'id,username'}).json()
  if str(identity.get('id'))!=uid:raise ValueError('identity_mismatch')
  data=api.call('GET',(uid,'media'),params={'fields':'id,media_type,media_product_type','limit':5}).json()
  if not isinstance(data.get('data'),list):raise ValueError('invalid_media_response')
  rows=data['data']
  if len(rows)>5 or any(not isinstance(row,dict) or not row.get('id') for row in rows):raise ValueError('invalid_media_response')
  # Never persist identifiers, captions, URLs, raw errors, paging tokens, or credentials.
  return {**result,'status':'PASS','connected':True,'read_check':{'provider':'Meta Graph API','observed':'authorized_account_and_media_page','result':'read_verified'},'media_items_checked':len(rows),'video_items_checked':sum(r.get('media_type')=='VIDEO' for r in rows),'pagination_followed':False}
 except Exception as error:
  code=None
  try:code=error.api_error_code()
  except (AttributeError,TypeError):pass
  reason='authorization_rejected' if code==190 else 'permission_or_eligibility_required' if code in (10,200) else 'provider_rate_limited' if code in (4,17,32,613) else 'provider_read_failed'
  return {**result,'status':'BLOCKED','reason':reason,**({'provider_error_code':code} if type(code) is int else {})}

def main():
 p=argparse.ArgumentParser();p.add_argument('--out',required=True);a=p.parse_args();r=probe(os.environ)
 out=Path(a.out);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r));return 0 if r['status']=='PASS' else 2
if __name__=='__main__':raise SystemExit(main())
