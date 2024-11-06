import os
import requests
import icalendar
import re
import json
from datetime import date, timedelta, datetime
from rich import print as printr
from calendar import monthrange
from requests import exceptions
from time import sleep

def print(*args): printr(f'[{datetime.now().strftime("%H:%M:%S")}]', *args) # custom print function: [hh:mm:ss] message

print('[+] Imported the libraries')

API_DIR = 'public/api'
SRC_DIR = 'src/api'
os.makedirs(API_DIR, exist_ok=True)
os.makedirs(SRC_DIR, exist_ok=True)
print('[+] Created the API directory')

# Dealing with the timetable API and simplifying the data
year = date.today().year
DP_CALENDAR_ID = 120

try:
	ttviewer = requests.post('https://fountainheadschool.edupage.org/timetable/server/ttviewer.js?__func=getTTViewerData', json={"__args":[None, year],"__gsh":"00000000"})

	if ttviewer.text.startswith('Error'):
		print(f'[red bold][-] {ttviewer.text}! Restorting to the default value: {DP_CALENDAR_ID}')
	else:
		ttviewerData = ttviewer.json()['r']['regular']['timetables']
		DP_TTnum = [elem['tt_num'] for elem in ttviewerData if 'DP' in elem['text']]
		DP_CALENDAR_ID = DP_CALENDAR_ID if not DP_TTnum else DP_TTnum[0]
		print(f'[+] Using the calendar ID: {DP_CALENDAR_ID}')
except exceptions.ConnectionError:
	print(f'[red bold][-] Connection Error! Restorting to the default value: {DP_CALENDAR_ID}')


resp = requests.post('https://fountainheadschool.edupage.org/timetable/server/regulartt.js?__func=regularttGetData', json={"__args":[None, str(DP_CALENDAR_ID)],"__gsh":"00000000"})
data = resp.json()
if data['r'].get('error'):
	print(f'[red bold][-] Error: {data["r"]["error"]}! Timetable will not be updated')
else:
	print('[+] Fetched Timetable Data')

	json.dump(data, open(f'{API_DIR}/timetable.json', 'w'))
	json.dump(data, open(f'{SRC_DIR}/timetable.json', 'w'))
	print('[+] Saved Timetable Data')

# Dealing with the google calendar to create the weekly, monthly and all event file with the date and their days
ical_url = 'https://calendar.google.com/calendar/ical/fountainheadschools.org_0emneups26ttn44bkg00lpji7s%40group.calendar.google.com/public/basic.ics'
# dayRegexr = r'^d(ay)? ?[1-6]$' # This one adds additional matching formats of D [1-6] and Day[1-6]. However, they are not yet used.
dayRegexr = r'^d(ay )?[1-6]$' # The current matching format is Day [1-6] and D[1-6].

resp = requests.get(ical_url).text
print('[+] Fetched Calendar Data')
cal = icalendar.Calendar.from_ical(resp)
print('[+] Parsed Calendar Data')

today = date.today()
start_of_week = today - timedelta(days=today.weekday())
end_of_week = start_of_week + timedelta(days=6)

start_of_month = today.replace(day=1)
end_of_month = today.replace(day=monthrange(today.year, today.month)[1])
print('[+] Calculated the date range')

events = []

for event in cal.walk('VEVENT'):
	if not re.match(dayRegexr, event.get('SUMMARY', '').casefold()): continue # Remove all without the D[1-6] name
	if event.get('DTSTART').params['VALUE'] != 'DATE': continue # Remove all non day events

	# Getting the simple (unimportant) bits
	start = event.get('DTSTART')
	end = event.get('DTEND')
	summary = event.get('SUMMARY')

	events.append({'day': summary[-1], 'date': start.dt})

print('[+] Extracted Important Calendar Data')

week = []
NextSeven = []
month = {str(x): [] for x in range(1, 7)}
all = {str(x): [] for x in range(1, 7)}

for event in sorted(events, key=lambda x: x['date']):
	day = event['day']
	startDt = event['date']
	strDate = event['date'].strftime('%d/%m/%Y')
	# Adding the event to the week, month and all list
	if start_of_week <= startDt <= end_of_week:
		week.append({'day': day, 'date': strDate})
	if start_of_month <= startDt <= end_of_month:
		month[day].append(strDate)
	all[day].append(strDate)
	if today <= startDt and len(NextSeven) < 7:
		NextSeven.append({'day': day, 'date': strDate})

print('[+] Processed the Calendar Data')

# Writing the files
json.dump(week, open(f'{API_DIR}/week.json', 'w'))
json.dump(week, open(f'{SRC_DIR}/week.json', 'w'))
json.dump(NextSeven, open(f'{API_DIR}/NextSeven.json', 'w'))
json.dump(NextSeven, open(f'{SRC_DIR}/NextSeven.json', 'w'))
json.dump(month, open(f'{API_DIR}/month.json', 'w'))
json.dump(all, open(f'{API_DIR}/all.json', 'w'))
print('[+] Saved the Calendar Data')

# Printing Some Stats
print()
print(f'[~] Working day this week: {len(week)}')
print(f'[~] Working day this month: {sum(len(day) for day in month.values())}')
print(f'[~] Total Number of working days: {sum(len(day) for day in all.values())}')
print()
print('[+] Done!')
