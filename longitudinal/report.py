"""V1.8: deterministic descriptive longitudinal report. SYNTHETIC DATA ONLY.
No patient clinical inference; strict provenance and method separation.
"""
import argparse
import datetime as dt
import json
import math
import statistics
from collections import defaultdict
from pathlib import Path

WATCH = {"RHR", "HRV", "SLEEP", "STEPS", "SPO2"}
SPECS = {"RHR": "Fréquence cardiaque au repos", "HRV": "Variabilité cardiaque",
         "SLEEP": "Durée de sommeil", "STEPS": "Nombre de pas", "SPO2": "Saturation mesurée par montre",
         "LDL_C": "LDL-cholestérol", "HBA1C": "HbA1c", "TG": "Triglycérides",
         "CREATININE": "Créatinine", "WAIST": "Tour de taille", "BFP": "Masse grasse estimée",
         "SBP": "Pression systolique", "GRIP": "Force de préhension"}


def parse_date(timestamp):
    value = dt.datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    if value.tzinfo is None:
        raise ValueError("Timezone missing")
    return value.astimezone(dt.timezone.utc).date()


def validate(items):
    if not items:
        raise ValueError("No data")
    people=set(); by_id={}
    for item in items:
        needed=("id","person_id","metric_code","method_code","value","unit","measured_at","source_namespace","source_device","synthetic")
        if any(k not in item for k in needed):
            raise ValueError("Missing provenance or required observation field")
        if item["synthetic"] is not True:
            raise ValueError("Real personal health data are not supported")
        if item["metric_code"] not in SPECS:
            raise ValueError("Unknown metric")
        if not isinstance(item["value"],(int,float)) or not math.isfinite(item["value"]):
            raise ValueError("Non-finite observation value")
        if not item["source_namespace"] or not item["source_device"]:
            raise ValueError("Incomplete source")
        parse_date(item["measured_at"])
        people.add(item["person_id"])
        if item["id"] in by_id:
            if by_id[item["id"]] != item:
                raise ValueError("Conflicting same observation id")
            raise ValueError("Duplicate observation id")
        by_id[item["id"]]=item
    if len(people)!=1:
        raise ValueError("Cross-patient merging forbidden")
    return people.pop()


def cohort(item):
    # Intentionally refuses to compare across device/vendor/method variations.
    return (item["metric_code"],item["method_code"],item["unit"],item["source_namespace"],item["source_device"])


def summarize_group(rows, start, end, min_days=7):
    sample=[r for r in rows if start<=parse_date(r["measured_at"])<=end]
    days=len({parse_date(r["measured_at"]) for r in sample})
    span=(end-start).days+1
    return {"n":len(sample),"observed_days":days,"coverage_pct":round(100*days/span,1),
            "mean":round(statistics.mean(r["value"] for r in sample),3) if days>=min_days else None,
            "ids":[r["id"] for r in sorted(sample,key=lambda x:(x["measured_at"],x["id"]))]}


def prepare_center(synthetic_demo, person_id):
    # Only the fixed bundled fake dataset. We do not silently ingest uncontrolled sources.
    result=[]
    mapping={"WAIST":("waist_tape","cm"),"BFP":("bioimpedance","%"),
             "SBP":("automated_bp_repeated","mmHg"),"GRIP":("grip_dynamometer","kg")}
    for raw in synthetic_demo["center"]:
        if raw["code"] not in mapping: continue
        method,unit=mapping[raw["code"]]
        if raw["unit"] != unit:raise ValueError("Center unit mismatch")
        result.append({"id":"demo-center-"+raw["id"],"person_id":person_id,"metric_code":raw["code"],
                       "method_code":method,"value":raw["value"],"unit":unit,
                       "measured_at":raw["date"]+"T12:00:00Z", "source_namespace":"demo_center_v1_2",
                       "source_device":raw["source"],"synthetic":True})
    return result


def create_report(observations, window_days=14, min_watch_days=7):
    person=validate(observations)
    if window_days<7 or window_days>45:raise ValueError("Invalid window size")
    groups=defaultdict(list)
    for obs in observations:groups[cohort(obs)].append(obs)
    comparisons=[]; inventory=[]
    for key,rows in sorted(groups.items()):
        code,method,unit,namespace,device=key
        rows=sorted(rows,key=lambda r:(r["measured_at"],r["id"]))
        first=parse_date(rows[0]["measured_at"]);last=parse_date(rows[-1]["measured_at"])
        common={"metric_code":code,"label":SPECS[code],"method_code":method,"unit":unit,
                "source_namespace":namespace,"source_device":device,"n":len(rows),
                "first_date":str(first),"last_date":str(last)}
        inventory.append({**common,"observation_ids":[r["id"] for r in rows]})
        if code in WATCH:
            if (last-first).days<2*window_days-1:
                comparisons.append({**common,"status":"insufficient_separation","reason":"période insuffisante pour deux fenêtres indépendantes"})
                continue
            before=summarize_group(rows, first,first+dt.timedelta(days=window_days-1),min_watch_days)
            after=summarize_group(rows,last-dt.timedelta(days=window_days-1),last,min_watch_days)
            if before["mean"] is None or after["mean"] is None:
                comparisons.append({**common,"status":"insufficient_coverage", "before":before,"after":after,
                                    "reason":"au moins sept jours distincts par fenêtre requis"})
                continue
            comparisons.append({**common,"status":"descriptive_comparison", "before":before,"after":after,
                                "delta":round(after["mean"]-before["mean"],3),"statistic":"arithmetic_mean"})
        elif len(rows)>=2 and first != last:
            a,b=rows[0],rows[-1]
            comparisons.append({**common,"status":"descriptive_comparison","statistic":"first_last_single_measurements",
                                "before":{"value":a["value"],"date":a["measured_at"],"ids":[a["id"]]},
                                "after":{"value":b["value"],"date":b["measured_at"],"ids":[b["id"]]},
                                "delta":round(b["value"]-a["value"],3),
                                "limitation":"Deux mesures isolées ne permettent pas de conclure à une tendance clinique."})
        else:
            comparisons.append({**common,"status":"single_observation", "reason":"aucune comparaison longitudinale fiable"})
    return {"schema_version":"1.8","synthetic":True,"person_id":person,
            "title":"Synthèse longitudinale descriptive — démonstration synthétique",
            "window_days":window_days,"inventory":inventory,"comparisons":comparisons,
            "cross_domain_panels":[
              {"id":"R01","name":"Morphologie, lipides et activité","metrics":["WAIST","BFP","LDL_C","TG","HBA1C","STEPS"]},
              {"id":"R05","name":"Fonction et activité","metrics":["GRIP","BFP","STEPS"]},
              {"id":"R07","name":"Sommeil et données de montre","metrics":["HRV","RHR","SLEEP","STEPS"]},
              {"id":"R10","name":"Trajectoire multi-source","metrics":["WAIST","SBP","HBA1C","RHR","SLEEP"]}
            ],"limitations":["Document uniquement descriptif, sans diagnostic, triage ni score de risque.",
              "Aucune inférence causale ou signification médicale à partir des deltas.",
              "Les moyennes de montre dépendent de la méthode, du port et des jours disponibles.",
              "Groupes séparés par métrique, méthode, unité, source et appareil.",
              "Aucune interpolation de données manquantes et aucun fusionnement SDNN/RMSSD.",
              "Les panneaux croisent des contextes, ils ne calculent pas de risque clinique."]}


def render_markdown(report):
    result=["# "+report["title"],"","> Jeu de données fictif. Aucun conseil médical ni interprétation clinique.","",
            "## Comparaisons sourcées",""]
    for c in report["comparisons"]:
        result.append("### "+c["label"]+" — "+c["method_code"])
        result.append("Source : "+c["source_namespace"]+" / "+c["source_device"])
        if c["status"]=="descriptive_comparison":
            a,b=c["before"],c["after"]
            left=a.get("mean",a.get("value"));right=b.get("mean",b.get("value"))
            result.append(f"Première période : {left} {c['unit']} ; dernière période : {right} {c['unit']} ; différence arithmétique : {c['delta']:+g} {c['unit']}.")
            result.append("Références des observations utilisées : "+", ".join(a["ids"]+b["ids"]))
        else:result.append("Comparaison non produite : "+c["reason"])
        result.append("")
    result += ["## Panneaux de recoupement (sans conclusion médicale)",""]
    for p in report["cross_domain_panels"]:
        available=[x for x in report["inventory"] if x["metric_code"] in p["metrics"]]
        result.append(f"- **{p['id']} — {p['name']}** : "+", ".join(x["label"] for x in available)+". Données non interprétées.")
    result += ["","## Limites",""]+["- "+x for x in report["limitations"]]
    return "\n".join(result)+"\n"


def main():
    cli=argparse.ArgumentParser()
    cli.add_argument("--input",required=True);cli.add_argument("--center",required=True)
    cli.add_argument("--out",required=True);cli.add_argument("--markdown",required=True)
    a=cli.parse_args()
    data=json.loads(Path(a.input).read_text(encoding="utf8"))
    demo=json.loads(Path(a.center).read_text(encoding="utf8"))
    if data.get("synthetic") is not True or demo.get("synthetic") is not True:raise ValueError("Only synthetic input accepted")
    observations=data["observations"]+prepare_center(demo,data["person_id"])
    report=create_report(observations)
    Path(a.out).write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    Path(a.markdown).write_text(render_markdown(report),encoding="utf8")
    print(json.dumps({"total":len(observations),"comparisons":len(report["comparisons"]),
                      "descriptive":sum(c["status"]=="descriptive_comparison" for c in report["comparisons"])},ensure_ascii=False))

if __name__ == "__main__":main()
