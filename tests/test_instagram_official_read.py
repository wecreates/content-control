import json,unittest
from scripts.instagram_official_read import probe
class API:
 def __init__(self,fail=None):self.calls=[];self.fail=fail
 def call(self,method,path,params):
  self.calls.append((method,path,params))
  if self.fail:raise self.fail
  data={'id':'123','username':'private-name'} if len(path)==1 else {'data':[{'id':'456','media_type':'VIDEO'}],'paging':{'next':'https://bad.invalid/?access_token=SECRET'}}
  class Response:
   def json(self):return data
  return Response()
class Tests(unittest.TestCase):
 def test_missing_authorization_never_calls_provider(self):
  self.assertEqual(probe({},lambda:self.fail('network'))['reason'],'authorization_missing')
 def test_only_two_gets_and_no_private_response_data(self):
  api=API();r=probe({'INSTAGRAM_ACCESS_TOKEN':'SECRET','INSTAGRAM_USER_ID':'123'},lambda:api)
  self.assertEqual(r['status'],'PASS');self.assertEqual(len(api.calls),2);self.assertTrue(all(x[0]=='GET' for x in api.calls));self.assertEqual(api.calls[1][2]['limit'],5)
  for secret in ('SECRET','private-name','456','bad.invalid'):self.assertNotIn(secret,json.dumps(r))
  self.assertFalse(r['publication_enabled']);self.assertFalse(r['full_analysis'])
 def test_provider_error_is_redacted_and_not_retried(self):
  class Rejected(Exception):
   def api_error_code(self):return 190
  api=API(Rejected('SECRET session cookie private-name'));r=probe({'INSTAGRAM_ACCESS_TOKEN':'SECRET','INSTAGRAM_USER_ID':'123'},lambda:api)
  self.assertEqual(r['reason'],'authorization_rejected');self.assertEqual(len(api.calls),1);self.assertNotIn('SECRET',json.dumps(r));self.assertFalse(r['connected'])
 def test_publication_and_invalid_id_block(self):
  for change in ({'PUBLICATION_ENABLED':'true'},{'INSTAGRAM_USER_ID':'https://other.invalid'}):
   r=probe({'INSTAGRAM_ACCESS_TOKEN':'SECRET','INSTAGRAM_USER_ID':'123',**change},lambda:self.fail('network'));self.assertEqual(r['status'],'BLOCKED')
 def test_actual_sdk_builds_without_network(self):
  from facebook_business.api import FacebookAdsApi
  from facebook_business.session import FacebookSession
  api=FacebookAdsApi(FacebookSession(access_token='fixture',timeout=20),api_version='v26.0',enable_debug_logger=False)
  self.assertEqual(api.get_num_requests_attempted(),0)
if __name__=='__main__':unittest.main()
