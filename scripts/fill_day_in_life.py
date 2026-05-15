#!/usr/bin/env python3
"""
fill_day_in_life.py — Fills in day_in_life for professions that don't have it.
Uses category templates + profession-name keyword overrides.
Only writes to professions where day_in_life is null/missing. Preserves existing ones.

Usage: python3 scripts/fill_day_in_life.py
"""
import json
import hashlib
from pathlib import Path

ROOT = Path(__file__).parent.parent

# ── Keyword overrides ─────────────────────────────────────────────────────────
# Checked against lowercased profession name. First match wins.
# Each entry: (terms_list, day_in_life_text)
KEYWORD_OVERRIDES = [
    # Healthcare
    (['cardiologist'],       "You review ECGs, interpret stress test results, and perform an angioplasty in the afternoon. Every decision you make directly affects whether someone's heart keeps beating."),
    (['neurologist'],        "You assess a patient with sudden weakness, order an MRI, and diagnose a small stroke. The afternoon is spent in clinic reviewing epilepsy and Parkinson's cases."),
    (['psychiatrist'],       "You spend 45-minute sessions with patients struggling with depression, psychosis, and anxiety. You adjust medication, write detailed case notes, and coordinate with a social worker."),
    (['orthopaedic', 'orthopedic'], "You perform a hip replacement in the morning, review post-op X-rays, then see 6 outpatients with joint pain and fractures in the afternoon."),
    (['pediatr'],            "You examine 12 children from newborns to teenagers — vaccinations, growth checks, fever workups. You explain diagnoses to worried parents as much as to young patients."),
    (['gynaecolog', 'gynecolog', 'obstetr'], "You start with two antenatal check-ups, assist a delivery, then hold an outpatient clinic for reproductive health consultations. No two days look the same."),
    (['oncologist'],         "You discuss a cancer diagnosis with a patient and their family, review chemotherapy response scans, and attend a tumour board meeting to plan a complex case."),
    (['anaesthes'],          "You assess patients pre-surgery, administer and monitor anaesthesia through a 3-hour procedure, then brief recovery nurses on post-op pain management."),
    (['dermatolog'],         "You examine 15 patients — eczema, acne, a suspicious mole. You biopsy the mole, prescribe topical treatments, and document every case carefully."),
    (['ophthalmolog'],       "You perform cataract surgeries in the morning and see patients with diabetic retinopathy and glaucoma in afternoon clinic — precision tools, millimetre accuracy."),
    (['endocrinolog'],       "You review blood glucose logs, adjust insulin regimens for diabetic patients, and counsel a teenager newly diagnosed with Type 1 diabetes."),
    (['gastroenterolog'],    "You perform two colonoscopies, review biopsy results from last week, and consult on a patient with chronic liver disease in the afternoon."),
    (['patholog'],           "You examine tissue biopsies under a microscope, write reports for 20 specimens, and flag a malignancy for immediate clinical follow-up."),
    (['radiolog'],           "You read 50 X-rays and MRI scans during the day, flag two abnormalities for urgent follow-up, and consult with the oncology team on a complex case."),
    (['nurse'],              "You take vitals on 8 patients at shift start, administer IV medications, assist with a wound dressing, and comfort a patient anxious about their surgery."),
    (['dentist', 'dental surgeon'], "You see 8 patients — two cleanings, one root canal, one extraction. Each appointment is 30–60 minutes of focused, precise work inside someone's mouth."),
    (['orthodontist'],       "You fit braces on a 14-year-old, adjust wires on three returning patients, and take X-rays to plan an adult's tooth alignment. Cases run 12–24 months each."),
    (['periodontist'],       "You perform a gum graft for a patient with recession, then deep-clean another's roots under local anaesthesia. Precision and patience define every session."),
    (['endodontist'],        "You perform 4 root canals today — cleaning, shaping, and sealing infected root systems under magnification. Patients walk out relieved rather than in pain."),
    (['pharmacist'],         "You dispense 80+ prescriptions, counsel patients on drug interactions, do a stock audit of controlled substances, and flag one dangerous drug combination."),
    (['physiotherap'],       "You see 6 patients across the day — a post-surgery knee, a tennis elbow, a lower back issue — guiding each through targeted exercise routines."),
    (['audiologist'],        "You perform hearing tests on 5 patients, fit a hearing aid for an elderly man, and counsel parents of a child with hearing loss on communication strategies."),
    (['optometrist'],        "You conduct eye examinations for 10 patients, prescribe glasses, detect early signs of glaucoma in one patient, and refer them to a specialist."),
    (['dietitian', 'nutritionist'], "You review a diabetic patient's food diary, create a meal plan for an athlete, and run a group session on portion control at a community health centre."),
    (['hospital administrator'], "You chair the morning operations meeting, review bed occupancy data, resolve a staffing gap in the ICU, and prepare a report for the hospital board."),
    (['ayurvedic'],          "You conduct pulse diagnosis, prescribe herbal formulations, and guide patients through dietary and lifestyle changes rooted in traditional wellness principles."),
    (['homeopath'],          "You take a 45-minute detailed case history — symptoms, temperament, lifestyle — and prescribe constitutional remedies tailored to the whole person."),
    (['speech'],             "You work with 5 patients — a child with a stutter, an adult recovering from a stroke — doing targeted articulation exercises and tracking their progress."),
    (['occupational therap'], "You assess a post-injury patient's ability to perform daily tasks, design a tailored rehabilitation programme, and teach adaptive techniques for independence."),

    # Technology
    (['software engineer', 'software developer'], "You open your laptop to a queue of code reviews, fix a tricky bug before lunch, and spend the afternoon building a feature that millions of users will see next week."),
    (['data scientist'],     "You pull a messy dataset, clean it, run a predictive model, and present your findings to the product team — who immediately want two more questions answered."),
    (['data analyst'],       "You build a sales dashboard in the morning, investigate a sudden drop in user signups, and present your root-cause analysis to the marketing team."),
    (['machine learning', 'ml engineer'], "You experiment with a new neural network architecture, debug a training pipeline that's producing skewed results, and deploy an updated recommendation model to production."),
    (['devops', 'site reliability', 'sre'], "You automate a deployment pipeline that used to take 2 hours manually, respond to a server alert at noon, and review infrastructure costs with the finance team."),
    (['cybersecurity', 'security analyst', 'ethical hacker'], "You run a penetration test on a client's web application, find a SQL injection vulnerability, document your findings, and present a remediation plan."),
    (['cloud architect', 'cloud engineer'], "You design the architecture for a new microservice on AWS, review a cost-optimization proposal, and troubleshoot a storage bottleneck in production."),
    (['network engineer'],   "You configure a new router, investigate packet loss on a client's VPN, and update firewall rules to close a newly discovered vulnerability."),
    (['ux', 'ui designer', 'product designer'], "You run a usability test with 3 users in the morning, redesign a confusing onboarding flow based on their feedback, and present wireframes to the product team."),
    (['product manager'],    "You prioritise the sprint backlog, mediate a disagreement between engineering and design, write user stories for a new feature, and update the roadmap deck."),
    (['blockchain'],         "You review a smart contract for security vulnerabilities, write unit tests, and prototype a new token mechanism on a test network."),
    (['game developer', 'game designer'], "You implement a physics mechanic in the morning, playtest for bugs in the afternoon, and collaborate with an artist on particle effects for a new level."),
    (['embedded', 'firmware'], "You write C code for a microcontroller, debug a timing issue on the oscilloscope, and validate sensor readings against the hardware spec."),
    (['web developer', 'frontend', 'backend', 'full stack'], "You build a responsive login page, fix a broken API endpoint, review a colleague's code, and push your changes to the staging server by end of day."),

    # Engineering
    (['civil engineer'],     "You visit a construction site at 8am to check foundation work, come back to review structural calculations, and sign off on material orders by evening."),
    (['structural engineer'], "You check load calculations for a 10-storey building, review blueprints for stress points, and attend a site meeting where contractors raise questions about the beam design."),
    (['geotechnical'],       "You analyse soil test bore logs, write a foundation recommendation report, and visit a hillside site to assess slope stability before construction begins."),
    (['transportation engineer', 'traffic engineer'], "You analyse traffic flow data, model the impact of a new flyover using simulation software, and present findings to the city municipal authority."),
    (['water resources', 'hydraulic'], "You review a dam discharge model, inspect a canal lining for seepage, and prepare an irrigation network design for a new agricultural zone."),
    (['environmental engineer'], "You conduct a water quality audit at an industrial site, review effluent treatment data, and write a compliance report for the pollution control board."),
    (['mechanical engineer'], "You design a component in CAD, run a stress simulation, review the factory floor to check if a new machine is installed per spec, then write up test findings."),
    (['automotive engineer'], "You test a vehicle suspension component on a rig, analyse vibration data, and collaborate with designers on weight reduction for next year's model."),
    (['aerospace', 'aeronautical'], "You run aerodynamics simulations on a wing design, review test-flight telemetry data, and attend a safety review board meeting for a component redesign."),
    (['electrical engineer'], "You design a power distribution circuit, simulate it for fault conditions, then walk the factory floor to troubleshoot a motor drive that's tripping unexpectedly."),
    (['electronics engineer'], "You design a PCB layout, test a prototype for signal integrity issues, and write firmware to interface a new sensor with the main microcontroller."),
    (['vlsi'],               "You spend the morning placing and routing a chip block in EDA tools, run timing analysis, and review simulation results to close a setup violation."),
    (['chemical engineer'],  "You monitor reactor temperatures on a production floor, troubleshoot an unexpected yield drop, and update the process control parameters to fix it."),
    (['biomedical engineer'], "You test a new glucose sensor prototype, review clinical trial data from a medical device, and collaborate with doctors to refine a prosthetic limb design."),
    (['petroleum engineer'], "You review well-log data from a new drill site, model reservoir pressure, and prepare a production optimisation plan for the offshore platform team."),
    (['mining engineer'],    "You inspect underground tunnels for structural integrity, review blast fragmentation results, and adjust the extraction plan for the next shift."),
    (['nuclear engineer'],   "You monitor reactor performance data, conduct a safety system inspection, and update emergency protocols based on a recent regulatory audit."),
    (['marine engineer'],    "You inspect an engine room on a vessel, diagnose a fuel pump fault, and supervise repairs before the ship's next voyage."),
    (['naval architect'],    "You work on the stability calculations for a new vessel design, review hull resistance test results from the towing tank, and update the ship's structural drawings."),
    (['mechatronics', 'robotics engineer'], "You program a robotic arm on the assembly line, debug a sensor calibration error, and test an automated pick-and-place routine for the new product batch."),
    (['industrial engineer'], "You map a production workflow to find a bottleneck, redesign the workstation layout to reduce walking time, and present your efficiency findings to the plant manager."),
    (['materials science engineer', 'metallurgist'], "You prepare alloy specimens, run tensile strength tests, analyse fracture surfaces under an electron microscope, and update the material specification sheet."),
    (['agricultural engineer'], "You inspect an irrigation pump system in a farm, redesign a sprinkler layout for better coverage, and test a new soil moisture sensor integration."),
    (['surveyor', 'geomatics'], "You set up total station equipment, take 200 survey measurements across a plot, process the data back in the office, and generate a topographic map."),

    # Science & Research
    (['physicist'],          "You run experiments on a quantum optics bench, analyse spectroscopy data, write a section of your research paper, and attend a journal club discussion."),
    (['astrophysicist', 'astronomer'], "You process telescope observation data collected overnight, model galaxy formation parameters, and present preliminary results at your department's weekly seminar."),
    (['chemist'],            "You synthesise a new compound, run NMR spectroscopy, analyse the results against your hypothesis, and update your lab notebook for peer review."),
    (['biochemist'],         "You run protein gel electrophoresis, analyse enzyme activity assays, and troubleshoot a reaction that isn't producing the expected yield."),
    (['biologist', 'microbiologist'], "You culture bacterial samples, stain slides for microscopy, run a PCR assay, and interpret the results against your experimental control group."),
    (['virologist'],         "You work with attenuated virus samples in a biosafety cabinet, run plaque assays to measure viral load, and review sequencing data for mutation patterns."),
    (['geneticist'],         "You analyse whole-genome sequencing output, identify a novel variant linked to a metabolic disorder, and draft a section of your research paper."),
    (['neuroscientist'],     "You perform immunohistochemistry on brain tissue slides, analyse synaptic density data under a confocal microscope, and review your postdoc's experiment design."),
    (['bioinformatician'],   "You write a Python pipeline to process 10GB of RNA-seq data, run differential expression analysis, and visualise the results in R for the lab meeting."),
    (['biostatistician'],    "You design a clinical trial's statistical analysis plan, run survival analysis on patient data, and advise the research team on sample size requirements."),
    (['geologist', 'geophysicist'], "You log rock core samples from a drilling site, map geological formations, and use seismic data to build a subsurface model for a mining client."),
    (['seismologist'],       "You review overnight seismograph data, locate a minor tremor's epicentre, and update the earthquake hazard model for a new construction project."),
    (['meteorologist'],      "You analyse atmospheric pressure maps, run weather prediction models, brief the aviation authority on tomorrow's conditions, and issue a storm alert."),
    (['oceanographer'],      "You process salinity and temperature data from sea buoys, model ocean current changes, and write a report on coral reef bleaching patterns."),
    (['climate scientist'],  "You run a climate simulation model, analyse 50-year temperature trend data, and contribute a section to an IPCC working group report."),
    (['ecologist'],          "You collect invertebrate samples from a river, analyse water quality parameters, and write a biodiversity assessment report for a hydropower project EIA."),
    (['soil scientist'],     "You take soil samples from a degraded farmland plot, run pH and nutrient tests, and recommend a soil restoration treatment for the farmer."),
    (['epidemiologist'],     "You analyse disease outbreak data from 3 districts, identify the exposure source, and brief the district health officer on containment recommendations."),
    (['archaeologist'],      "You lead a field excavation, document and photograph artefacts, record stratigraphy layers, and bring finds back to the lab for cleaning and cataloguing."),
    (['anthropologist'],     "You conduct interviews in a rural community, transcribe field notes, and analyse how changing land use affects traditional social structures."),
    (['nanotechnologist'],   "You prepare nanoparticle samples in a cleanroom, run electron microscopy characterisation, and test drug delivery efficacy in a cell culture model."),
    (['materials scientist'], "You synthesise a new polymer composite, run thermal analysis tests, and compare the results against current industry materials to justify the improvement."),
    (['toxicologist'],       "You run dose-response tests on cell cultures, analyse liver enzyme markers for chemical exposure, and write a safety assessment report for a new industrial compound."),
    (['pharmacognosist'],    "You extract plant compounds using solvent techniques, run chromatography to identify active phytochemicals, and document findings for herbal medicine research."),

    # Arts & Media
    (['graphic designer'],   "You refine a brand identity package in the morning, present logo options to a client over a video call, and spend the afternoon building social media templates."),
    (['filmmaker', 'film director'], "You review yesterday's footage, give notes to the editor, scout a new location in the afternoon, and have a production meeting with the crew."),
    (['photographer'],       "You shoot a corporate headshot session in the morning, cull and edit 200 images in Lightroom, and deliver the final gallery to the client by evening."),
    (['animator'],           "You rig a 3D character model, animate a 5-second walk cycle, review feedback from the art director, and clean up keyframes before the end of day."),
    (['journalist', 'reporter'], "You cover a press briefing, interview a local official, write a 600-word story under deadline, and pitch your editor three story ideas for next week."),
    (['author', 'novelist'], "You write 1,000 words in the morning session, research a historical detail for your chapter, review editorial feedback on the previous chapter in the afternoon."),
    (['copywriter'],         "You write ad copy for three different campaigns, attend a creative brief with the client, and revise a tagline five times until it clicks."),
    (['video editor'],       "You assemble a rough cut of a corporate video, add motion graphics, sync audio, and share a review link with the director for feedback."),
    (['vfx', 'visual effects'], "You composite a green-screen shot, track a camera move for a CG element, and render the final output for the director's approval."),
    (['music producer', 'music composer'], "You record a session musician's guitar parts, layer electronic beats, mix levels across 24 tracks, and bounce a demo for the artist to review."),
    (['actor'],              "You rehearse lines in the morning, film a 3-scene dialogue sequence, review playback with the director, and do two more takes to nail the emotional beat."),
    (['dancer', 'choreographer'], "You lead a two-hour rehearsal, break down a 32-count routine into teachable sections, and film a performance run-through for the artistic director."),
    (['fashion designer'],   "You sketch 8 new garment silhouettes, meet the fabric supplier to choose materials, and supervise the first pattern cut with the tailoring team."),
    (['illustrator'],        "You sketch thumbnail compositions for a children's book spread, refine the chosen one in Procreate, and send a colour rough to the publisher for approval."),
    (['musician', 'singer'], "You run a 2-hour vocal and instrument practice session, record a demo track for an upcoming gig, and collaborate on lyrics with your bandmate."),
    (['art director'],       "You brief the design team on a campaign concept, review creative outputs, reject two directions, and refine the visual language with the lead designer."),

    # Finance & Business
    (['chartered accountant', 'ca '], "You review a client's balance sheet, identify a tax-saving opportunity, prepare journal entries, and advise the client on advance tax payment before the deadline."),
    (['investment banker'],  "You model a company's valuation for an M&A deal, attend a pitch meeting with a target company's management, and revise the financial model at midnight."),
    (['financial analyst'],  "You build a discounted cash flow model, analyse a company's quarterly earnings, and present a buy/sell recommendation to the portfolio manager."),
    (['actuary'],            "You model mortality risk for a new insurance product, validate assumptions with past claims data, and present premium pricing to the underwriting team."),
    (['consultant', 'management consultant'], "You interview client stakeholders to diagnose an operational issue, structure your findings into a slide deck, and present recommendations to the C-suite."),
    (['marketing manager'],  "You review campaign performance metrics, brief the creative agency on a new product launch, and optimise ad spend allocation across digital channels."),
    (['business analyst'],   "You map a flawed business process, document requirements for a new IT system, and run a workshop with stakeholders to validate your proposed solution."),
    (['supply chain'],       "You track delayed shipments, renegotiate lead times with a supplier, and optimise the inventory reorder point using demand forecast data."),
    (['hr ', 'human resources'], "You screen 15 job applications, conduct two interviews, run an onboarding session for new joiners, and mediate a workplace dispute."),
    (['economist'],          "You analyse GDP and inflation data, model the impact of a proposed policy change, and write a briefing paper for a government ministry."),

    # Law & Government
    (['ias', 'ips', 'civil servant', 'ifs '], "You chair a district-level review meeting, review pending files on land acquisition, respond to a public grievance, and brief the senior officer on a developing situation."),
    (['diplomat'],           "You attend a bilateral meeting with a foreign counterpart, draft a cable to headquarters summarising key outcomes, and represent your country at an evening cultural event."),
    (['lawyer', 'advocate'], "You prepare case notes for a morning hearing, argue before the judge for 45 minutes, meet a new client to understand their property dispute, and research a precedent."),
    (['judge'],              "You preside over three hearings, read written arguments from both parties on a complex case, reserve your order, and review pending matters on your docket."),
    (['police'],             "You conduct a witness interview, review CCTV footage for an investigation, attend a court hearing, and coordinate with a field team on an ongoing case."),
    (['public policy', 'policy analyst'], "You analyse the impact of a proposed education regulation, draft a policy brief with recommendations, and present findings to the ministry's advisory committee."),
    (['politician', 'legislator'], "You attend a parliament session, review a committee report on healthcare funding, meet constituents during your weekly open office, and draft a question for debate."),
    (['legal researcher'],   "You study case law on a constitutional question, write a legal commentary, and advise a think tank on the implications of a new legislation."),

    # Education
    (['teacher', 'schoolteacher'], "You take three 40-minute classes, check 30 assignments, plan tomorrow's lesson using a new interactive method, and meet a student's parent after school."),
    (['professor', 'lecturer'], "You deliver a 90-minute undergraduate lecture, hold office hours for 4 students, review a postgraduate thesis chapter, and write a section of your research paper."),
    (['school counsellor'],  "You meet 3 students individually — one struggling academically, one anxious about exams, one with peer conflict — and follow up with a teacher on a behavioural concern."),
    (['curriculum'],         "You review a Science syllabus for Grade 9, update learning outcomes to align with the new board guidelines, and pilot-test a lesson plan with a teacher."),
    (['educational technologist'], "You design an interactive e-learning module, test it with a group of students, collect engagement data, and iterate the content based on drop-off points."),

    # Agriculture & Environment
    (['agricultural scientist', 'agronomist'], "You visit an experimental plot, collect crop samples, run soil nutrient tests in the lab, and analyse yield data to refine your fertiliser recommendation."),
    (['horticulturist'],     "You inspect greenhouse crops for pests, adjust irrigation schedules based on weather data, and advise a client on variety selection for the coming season."),
    (['forester', 'forest officer'], "You patrol a forest section, document signs of illegal felling, collect biodiversity samples, and update the forest management plan."),
    (['wildlife biologist', 'wildlife scientist'], "You track animal movement data from GPS collars, conduct a transect survey in the field, and write a report on population trends for the wildlife authority."),
    (['environmental consultant'], "You conduct an Environmental Impact Assessment site visit, collect air and water samples, and write a compliance report for a factory seeking regulatory clearance."),
    (['fisheries scientist', 'aquaculture'], "You collect fish samples from a farm pond, test water oxygen and pH levels, analyse growth data, and recommend feed adjustments for the farm operator."),
    (['botanist'],           "You collect plant specimens in the field, press and label them for the herbarium, run DNA extraction for phylogenetic analysis, and update your species database."),
    (['marine biolog'],      "You dive to collect coral tissue samples, photograph bleaching extent, process samples in the onboard lab, and log findings into the long-term database."),

    # Social & Welfare
    (['social worker'],      "You visit a family flagged for child welfare concerns, assess living conditions, coordinate with the school and local authority, and document your case notes."),
    (['ngo', 'development professional'], "You run a community meeting in a village, collect feedback on a water sanitation scheme, and write a donor progress report in the afternoon."),
    (['counsellor', 'psychologist'], "You conduct 4 therapy sessions — grief, anxiety, relationship issues — write detailed case notes, and consult with a psychiatrist on a complex referral."),
    (['community'],          "You facilitate a self-help group session, connect a family to a government scheme they were unaware of, and follow up on a child's school enrolment."),

    # Sports & Fitness
    (['cricketer', 'cricket coach'], "You run a 2-hour batting and fielding drill session, review video of yesterday's match to spot technical errors, and meet with the selectors to discuss the squad."),
    (['football', 'footballer'], "You train for 3 hours — fitness, ball work, tactics — attend a press conference, and review footage of the next opponent's last match with the coaching staff."),
    (['sports coach', 'athletic coach'], "You plan and run a morning strength conditioning session, review an athlete's performance data, and tweak their training programme for the upcoming competition."),
    (['personal trainer', 'fitness trainer'], "You lead 4 personal training sessions back-to-back, design a nutrition plan for a client, and review a client's progress against their 3-month goal."),
    (['physiotherapist sports', 'sports physio'], "You treat a sprinter's hamstring, tape a footballer's ankle before training, and advise a swimmer on a modified training load to protect a shoulder injury."),
    (['yoga instructor'],    "You lead two morning yoga classes, create a new restorative sequence for an evening class, and counsel a student on managing stress through breathwork."),
    (['sports psychologist'], "You run a mental skills session with an athlete on pre-competition anxiety, use visualisation techniques with a team before a big match, and write up case notes."),
    (['nutritionist sports', 'sports nutritionist'], "You analyse an athlete's food diary, adjust carbohydrate loading for a marathon runner's race week, and present nutrition periodisation to a football club's coaching staff."),

    # Hospitality & Food
    (['chef', 'head chef', 'executive chef'], "You arrive at 10am to prep mise en place, develop a new seasonal dish for the menu, supervise the dinner service, and give feedback to the junior kitchen team."),
    (['hotel manager'],      "You chair the daily operations briefing, resolve a guest complaint about a room issue, review occupancy and revenue reports, and meet a corporate client."),
    (['event manager'],      "You coordinate vendor deliveries for a 300-person conference, manage last-minute stage changes, brief the AV crew, and oversee the event run-of-show."),
    (['pastry chef', 'baker'], "You prepare croissant dough at 5am, bake 8 varieties of bread and pastry before opening, train a new apprentice on tempering chocolate, and cost next week's menu."),
    (['sommelier', 'wine'],  "You taste and score 12 new wine samples for the cellar, advise a guest on a food-pairing choice, and update the wine list with detailed tasting notes."),
    (['travel consultant', 'tour operator'], "You plan a custom 10-day itinerary for a family, negotiate rates with 3 hotels, handle a last-minute flight change for a client, and send out 5 quotations."),

    # Transport & Logistics
    (['pilot'],              "You complete pre-flight checks, brief your co-pilot on the route and weather, fly 200 passengers across a 2-hour sector, and debrief the cabin crew after landing."),
    (['merchant navy', 'ship captain', 'naval officer'], "You review the navigation plan for the voyage, conduct a safety drill with the crew, navigate through a shipping lane, and log the day's operations."),
    (['logistics manager'],  "You track shipment delays on the operations dashboard, negotiate with a freight forwarder to reroute a stuck container, and update the client on delivery timelines."),
    (['supply chain manager'], "You analyse procurement lead times, identify a single-source supplier risk, and work with the planning team to build a buffer stock strategy."),
    (['air traffic controller'], "You manage 15 aircraft in your sector simultaneously, sequence approaches to the runway, issue a go-around instruction for a spacing conflict, and hand off to the next shift."),
    (['railway engineer', 'train driver'], "You complete a safety inspection of the locomotive, drive a 4-hour intercity route, stop at 8 stations on schedule, and file an incident report for a signal anomaly."),
    (['truck driver', 'lorry driver'], "You plan your route using a live traffic app, load cargo and verify the manifest, drive a 400km intercity route, and complete delivery documentation at the destination."),

    # Trades & Construction
    (['electrician'],        "You install wiring in a new apartment block, fault-find a tripping circuit breaker in a commercial kitchen, and test all installations against safety standards."),
    (['plumber'],            "You fix a burst pipe in a residential building, install a new bathroom fitting, and quote a client for a hot water system upgrade."),
    (['carpenter', 'joiner'], "You measure and cut timber for a new staircase, fit kitchen cabinet frames, sand and finish a solid wood tabletop, and check the job against the architectural drawings."),
    (['welder'],             "You read fabrication drawings, prep and weld structural steel joints, inspect your welds visually and with a gauge, and grind them smooth before final inspection."),
    (['mason', 'bricklayer'], "You lay 500 bricks for a load-bearing wall, check alignment with a spirit level, mix mortar to the right consistency, and prep the next course for tomorrow."),
    (['site supervisor', 'construction site manager'], "You lead the morning toolbox talk, inspect scaffolding safety, resolve a material delivery delay, and update the project manager on daily progress."),
    (['quantity surveyor'],  "You measure quantities from architectural drawings, prepare a bill of materials for a tender package, and check a contractor's interim payment claim."),
    (['painter decorator', 'painter and decorator'], "You prep surfaces, apply primer and two finish coats on a commercial space, calculate material use for the next job, and clean and store equipment."),

    # Architecture & Design
    (['architect'],          "You work on design development drawings for a 6-storey residential building, meet the client to review the floor plan, and liaise with the structural engineer on column placement."),
    (['urban planner', 'town planner'], "You analyse land use data for a new township layout, attend a public consultation meeting, and draft zoning regulations for a mixed-use development corridor."),
    (['interior designer'],  "You visit a site to take measurements, present a mood board and material palette to the client, and coordinate with the furniture vendor on delivery timelines."),
    (['landscape architect'], "You design a park masterplan, select plant species suitable for the local climate, and prepare planting layout drawings for the contractor."),
    (['industrial designer'], "You sketch product form concepts, build a foam prototype, test ergonomics with 3 users, and refine the design based on grip feedback."),
    (['product designer'],   "You create CAD models for a new consumer product, run structural simulations, and present two design directions to the client team for approval."),

    # Mental Health & Wellness
    (['clinical psychologist'], "You run 4 therapy sessions using CBT with patients dealing with OCD, trauma, and depression. You write case notes and consult with a psychiatrist on one complex referral."),
    (['counselling psychologist'], "You facilitate a grief support group, conduct two individual sessions on relationship issues, and supervise a trainee counsellor's case presentation."),
    (['rehabilitation counsellor'], "You assess a client's functional limitations after a workplace injury, create a vocational rehabilitation plan, and liaise with the employer on a return-to-work programme."),
    (['art therapist', 'music therapist'], "You run a therapeutic art session with a group of children with trauma history, observe and interpret their creative expressions, and document clinical observations."),
    (['meditation', 'mindfulness instructor'], "You lead a 45-minute guided mindfulness session, run a stress-reduction workshop for corporate employees, and develop a new 8-week programme curriculum."),

    # Public Health & Policy
    (['public health officer', 'public health professional'], "You analyse district disease surveillance data, coordinate a vaccination camp logistics, brief community health workers, and report outbreak metrics to the state health authority."),
    (['health policy analyst'], "You review a proposed tobacco regulation, model its impact on cancer incidence, draft a policy brief, and present findings to a government advisory panel."),

    # Niche & Emerging
    (['data engineer'],      "You build a data pipeline ingesting real-time sensor data, optimise a slow SQL query, and document the ETL architecture for the team's wiki."),
    (['ai engineer', 'artificial intelligence'], "You fine-tune a language model on domain-specific data, evaluate output quality with test prompts, and prepare a deployment plan for a production API."),
    (['iot'],                "You configure a fleet of IoT sensors, debug a connectivity failure in a smart building installation, and analyse the time-series data for anomaly patterns."),
    (['space technology', 'isro', 'satellite'],  "You work on orbit simulation software, review telemetry data from a satellite in orbit, and attend a mission planning review meeting."),
    (['drone', 'uav'],       "You calibrate a drone's sensors, fly a photogrammetry survey mission over an agricultural field, process the images into a 3D map, and report the crop health index."),
    (['esports', 'gaming professional'], "You train 6 hours — individual mechanics, team scrimmages, and VOD reviews. You attend a strategy meeting with the coaching staff and stream 2 hours for your community."),
    (['content creator', 'youtuber', 'influencer'], "You script a video, film three takes, edit the final cut in Premiere, write captions and hashtags, and respond to comments once it's live."),
    (['social media manager'], "You schedule 5 posts across platforms, respond to DMs and comments, analyse reach and engagement from yesterday's campaign, and brief the graphic designer on new creatives."),
    (['cyber law', 'legal tech'], "You review a data privacy compliance gap for a tech startup, advise on GDPR applicability, and draft a data processing agreement for a new vendor."),
    (['forensic scientist', 'forensic analyst'], "You examine fingerprint lifts from a crime scene, run a DNA profile comparison against the NCRB database, and submit your findings as a court-admissible expert report."),
    (['geospatial', 'gis analyst'], "You process satellite imagery to map land cover changes, run spatial analysis on flood risk zones, and produce visualisation maps for a government planning authority."),
    (['renewable energy', 'solar energy', 'wind energy'], "You analyse solar irradiance data for a new farm site, size the panel array and inverter, and prepare a yield simulation report for the project investor."),
    (['ev ', 'electric vehicle'], "You work on battery thermal management simulations, review range test data for a new model, and collaborate with the hardware team on BMS firmware updates."),
    (['fintech'],            "You review API logs for a failed payment transaction, work with the backend team to fix the issue, and run compliance checks on a new feature before launch."),
    (['biotech', 'biotechnology'], "You run CRISPR gene editing protocols, analyse PCR results for off-target effects, and present your week's experimental findings at the lab meeting."),
]

# ── Category fallback templates ───────────────────────────────────────────────
# Used when no keyword override matches. One template per category.
# {name} = profession name, {summary_verb} = first verb from summary if extractable
CATEGORY_FALLBACKS = {
    'Healthcare':
        "You start with morning ward rounds, examine patients, update treatment plans, and consult with colleagues on complex cases before afternoon outpatient clinic.",
    'Technology':
        "You write and review code in the morning, attend a team standup, debug an issue that's been blocking a colleague, and plan the next sprint's features.",
    'Engineering':
        "You review technical drawings, run calculations or simulations, visit a site or production floor to check progress, and write up your findings in a report.",
    'Arts & Media':
        "You work on a creative project in the morning, review feedback from a client or director, refine your output, and collaborate with your team on the next brief.",
    'Science & Research':
        "You run experiments in the lab, analyse data from the previous run, update your research notes, and discuss findings with your supervisor or research group.",
    'Finance & Business':
        "You review financial reports in the morning, model scenarios for a client decision, attend meetings with stakeholders, and prepare a presentation for the afternoon.",
    'Finance — Specialized Niche':
        "You analyse market data and financial instruments, model risk and return scenarios, prepare research notes, and brief the portfolio or risk management team.",
    'Education':
        "You teach classes, review and return student work, prepare tomorrow's lesson plan, and meet with students or parents to discuss progress.",
    'Law & Government':
        "You review case files or policy documents, attend hearings or meetings, draft written submissions or orders, and advise colleagues or clients on next steps.",
    'Agriculture & Environment':
        "You visit a field or site, collect samples or data, analyse results in the lab or office, and write recommendations for farmers, clients, or the regulatory authority.",
    'Social & Welfare':
        "You meet clients or community members, assess their needs, connect them to services or resources, and document your casework to track progress over time.",
    'Sports & Fitness':
        "You run a training session, review performance data, work with athletes on specific weaknesses, and coordinate with the support team on conditioning and recovery.",
    'Hospitality & Food':
        "You oversee preparation and service, manage your team through a busy period, resolve any guest or customer issues, and review the day's quality and costs.",
    'Transport & Logistics':
        "You review the day's operations data, coordinate with field teams to resolve delays, update tracking systems, and ensure delivery or movement schedules stay on track.",
    'Trades & Construction':
        "You arrive on site, review the day's work order, complete your trade tasks to specification, inspect your work against safety standards, and update the job log.",
    'Architecture & Design':
        "You work on design drawings or renders, present concepts to clients, coordinate with engineers or contractors on technical details, and refine based on feedback.",
    'Mental Health & Wellness':
        "You hold therapy or counselling sessions, write case notes, consult with clinical colleagues on complex cases, and develop or update client treatment plans.",
    'Public Health & Policy':
        "You analyse health data, write briefs or reports for the health authority, coordinate with field health workers, and present findings to government or community stakeholders.",
    'Niche & Emerging Professions':
        "You work at the cutting edge of your field — experimenting, building prototypes, analysing results, and collaborating with a cross-disciplinary team on new problems.",
}


def pick_day_in_life(profession: dict) -> str:
    name_lower = profession['name'].lower()
    summary_lower = (profession.get('summary') or '').lower()
    text = name_lower + ' ' + summary_lower

    for terms, dil in KEYWORD_OVERRIDES:
        if any(t in text for t in terms):
            return dil

    return CATEGORY_FALLBACKS.get(
        profession['category'],
        "You work on your primary tasks for the day, collaborate with colleagues, review your outputs, and prepare for tomorrow's priorities."
    )


def main():
    data = json.loads((ROOT / 'data' / 'professions.json').read_text())
    items = data['items']

    filled_before = sum(1 for p in items if p.get('day_in_life'))
    updated = 0

    for p in items:
        if not p.get('day_in_life'):
            p['day_in_life'] = pick_day_in_life(p)
            updated += 1

    data['items'] = items
    (ROOT / 'data' / 'professions.json').write_text(
        json.dumps(data, indent=2, ensure_ascii=False), encoding='utf-8'
    )

    filled_after = sum(1 for p in items if p.get('day_in_life'))
    print(f'Before: {filled_before} filled  |  Added: {updated}  |  After: {filled_after}/{len(items)}')

    # Spot-check 5 that were empty
    samples = [p for p in items if p['category'] in ('Engineering', 'Arts & Media', 'Finance & Business', 'Trades & Construction', 'Niche & Emerging Professions')]
    for p in samples[:5]:
        print(f'\n  [{p["category"]}] {p["name"]}')
        print(f'  {p["day_in_life"]}')


if __name__ == '__main__':
    main()
