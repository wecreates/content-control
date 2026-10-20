"""Independent necessary black-ink paperback option admission, not approval.

KDP G201857950, retrieved 2026-10-20:
https://kdp.amazon.com/en_US/help/topic/G201857950
Only the explicitly reviewed US/JP tables are supported. Do not infer worldwide
availability, rights or an official calculator template from these limits.
"""
import math

REGULAR=(828,776,812)  # white, cream, groundwood
SQUARE=(800,750,784)
A4=(780,730,764)
LARGE=(590,550,578)
US={size:REGULAR for size in ((5,8),(5.06,7.81),(5.25,8),(5.5,8.5),
    (6,9),(6.14,9.21),(6.69,9.61),(7,10),(7.44,9.69),(7.5,9.25),(8,10))}
US.update({(8.25,6):SQUARE,(8.25,8.25):SQUARE,(8.27,11.69):A4,
           (8.5,8.5):LARGE,(8.5,11):LARGE})
JP={size:REGULAR for size in ((4.06,7.17),(4.13,6.81),(4.41,6.85),
    (5,7.4),(5.04,7.17),(5.83,8.27),(5.98,8.58),(5.98,8.94),
    (7.17,10.12),(7.17,8.11))}
JP.update({(8.27,10.12):A4,(8.27,11.69):A4})


def require_paperback_options(spec, country):
    # The target is supplied by the authenticated task host, never selected
    # from a producer's package fields, locale or a convenient default.
    if not isinstance(spec,dict) or type(country) is not str or country not in ('US','JP'):
        raise ValueError('KDP_PRINT_OPTIONS_UNSUPPORTED')
    trim=spec.get('trim_inches');paper=spec.get('paper_type')
    if (spec.get('ink_type')!='black' or type(paper) is not str or
            paper not in ('white','cream','groundwood') or
            not isinstance(trim,list) or len(trim)!=2 or
            any(type(v) not in (int,float) or not 0<v<20 or not math.isfinite(v) for v in trim)):
        raise ValueError('KDP_PRINT_OPTIONS_UNSUPPORTED')
    limits=(US if country=='US' else JP).get(tuple(trim))
    if limits is None:
        raise ValueError('KDP_PRINT_OPTIONS_UNSUPPORTED')
    count=spec.get('page_count')
    if type(count) is not int or not 24<=count<=limits[('white','cream','groundwood').index(paper)]:
        raise ValueError('KDP_PRINT_PAGE_LIMIT')
    return True
