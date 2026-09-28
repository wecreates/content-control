#!/usr/bin/env python3
import argparse,json
from pathlib import Path

ENVIRONMENTS=[
"white_stage","bank_counter","airport_lounge","retail_store","apartment","finance_metaphor_world",
"grocery_checkout","restaurant_table","hotel_lobby","airplane_cabin","baggage_claim","luxury_store",
"gas_station","car_dealership","college_dorm","hospital_billing","collections_office","courtroom_metaphor",
"tax_office","stock_exchange_parody","casino","debt_dungeon","rewards_factory","bank_vault","credit_score_lab",
"subway_platform","office_cubicle","coffee_shop","online_checkout_world","subscription_maze","interest_treadmill"
]
PROPS=[
"wallet","card","calculator","phone","receipt","calendar","price_tag","coin","fee_meter","points_counter",
"luggage","boarding_pass","menu","hotel_key","gas_pump","car_key","loan_contract","medical_bill","gavel",
"tax_form","stock_ticker","slot_machine","debt_chain","reward_box","vault_door","score_gauge","subscription_badge",
"shopping_cart","coupon","clock","treadmill","bucket","flood_meter","ice_cube","carrot","magnifying_glass"
]
FX=["impact_lines","speed_lines","coin_rain","paper_burst","smoke_pop","glow_pulse","motion_streak","dust_puff","shock_ring","screen_crack","confetti","number_particles"]

def build(topic):
    assets=[]
    for x in ENVIRONMENTS: assets.append({"id":x,"type":"environment","style":"minimal_line_art","reusable":True})
    for x in PROPS: assets.append({"id":x,"type":"prop","style":"black_line_white_fill","reusable":True})
    for x in FX: assets.append({"id":x,"type":"fx","style":"2d_graphic","reusable":True})
    return {
      "schema_version":2,"topic":topic,
      "style_bible":{"background":"#FFFFFF","line":"#111111","accents":["#11A7A7","#EF3E36","#F4C542"],"typography":"bold sans","negative_space":"high","line_weight_px":6},
      "environments":[{"id":x} for x in ENVIRONMENTS],
      "props":[{"id":x} for x in PROPS],"fx":[{"id":x} for x in FX],
      "asset_count":len(assets),"assets":assets,"publication_enabled":False
    }

def main():
    ap=argparse.ArgumentParser();ap.add_argument("--topic",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();r=build(a.topic);Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS","assets":r["asset_count"]}))
if __name__=="__main__":main()
