import os
import requests
import icalendar
import re
import json
from datetime import date, timedelta, datetime


def print(*args): __builtins__.print(f'[{datetime.now().strftime("%H:%M:%S")}]', *args) # custom print function: [hh:mm:ss] message

print('Imported the libraries')

API_DIR = 'public/api'
SRC_DIR = 'src/api'
os.makedirs(API_DIR, exist_ok=True)
os.makedirs(SRC_DIR, exist_ok=True)
print('Created the API directory')

# Dealing with the timetable API and simplifying the data

DP_CALENDAR_ID = 99
resp = requests.post('https://fountainheadschool.edupage.org/timetable/server/regulartt.js?__func=regularttGetData', json={"__args":[None, str(DP_CALENDAR_ID)],"__gsh":"00000000"})
data = resp.json()
print('Fetched Timetable Data')

json.dump(data, open(f'{API_DIR}/timetable.json', 'w'))
json.dump(data, open(f'{SRC_DIR}/timetable.json', 'w'))
print('Saved Timetable Data')

# Dealing with the google calendar to create the weekly, monthly and all event file with the date and their days
ical_url = 'https://calendar.google.com/calendar/ical/fountainheadschools.org_0emneups26ttn44bkg00lpji7s%40group.calendar.google.com/public/basic.ics'
# dayRegexr = r'^[dD](?:ay|AY)? ?([1-6])$' # The calendar tends to follow the D[1-6] rule but you never know
dayRegexr = r'^D[1-6]$'

resp = requests.get(ical_url).text
print('Fetched Calendar Data')
cal = icalendar.Calendar.from_ical(resp)
print('Processed Calendar Data')

today = date.today()
start_of_week = today - timedelta(days=today.weekday())
end_of_week = start_of_week + timedelta(days=6)

start_of_month = today.replace(day=1)
end_of_month = start_of_month.replace(month=start_of_month.month+1) - timedelta(days=1)
print('Calculated the date range')

week = []
NextSeven = []
month = {'1': [], '2': [], '3': [], '4': [], '5': [], '6': []}
all = {'1': [], '2': [], '3': [], '4': [], '5': [], '6': []}

for event in cal.walk('VEVENT'):
	if not re.match(dayRegexr, event.get('SUMMARY', '')): continue # Remove all without the D[1-6] name
	if event.get('DTSTART').params['VALUE'] != 'DATE': continue # Remove all non day events

	# Getting the simple (unimportant) bits
	start = event.get('DTSTART')
	end = event.get('DTEND')
	summary = event.get('SUMMARY')

	# Getting the important bits
	day = summary[1]
	strDate = start.dt.strftime('%d/%m/%Y')

	# Adding the event to the week, month and all list
	if start_of_week <= start.dt <= end_of_week:
		week.append({'day': day, 'date': strDate})
	if start_of_month <= start.dt <= end_of_month:
		month[day].append(strDate)
	all[day].append(strDate)
	if today <= start.dt and len(NextSeven) < 7:
		NextSeven.append({'day': day, 'date': strDate})
print('Parsed the Calendar Data')

# Writing the files
json.dump(week, open(f'{API_DIR}/week.json', 'w'))
json.dump(week, open(f'{SRC_DIR}/week.json', 'w'))
json.dump(NextSeven, open(f'{API_DIR}/NextSeven.json', 'w'))
json.dump(NextSeven, open(f'{SRC_DIR}/NextSeven.json', 'w'))
json.dump(month, open(f'{API_DIR}/month.json', 'w'))
json.dump(all, open(f'{API_DIR}/all.json', 'w'))
print('Saved the Calendar Data')