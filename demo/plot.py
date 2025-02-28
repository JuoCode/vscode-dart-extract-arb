import matplotlib.pyplot as plt
import numpy as np

# Number of languages
languages = np.arange(1, 50,step=5)  

# Time per method
manual_time = languages * 35.75  
automated_time = languages * 1.25  

# Convert time to more readable format (minutes, then hours)
def convert_time(seconds):
    if seconds >= 3600:
        return f"{seconds / 3600:.1f} hrs"
    elif seconds >= 60:
        return f"{seconds / 60:.1f} min"
    else:
        return f"{seconds:.1f} sec"

# Plot
plt.figure(figsize=(8, 5))
plt.plot(languages, manual_time, label=f"Manual: ~{35.75} sec per language", marker="o", linestyle="--", color="r")
plt.plot(languages, automated_time, label=f"Automated: ~{1.25} sec per language", marker="s", linestyle="-", color="g")

# Labels and title
plt.xlabel("Number of Languages")
plt.ylabel("Time Taken")
plt.title("Human vs automation for a single line of text")
plt.legend()
plt.grid(True)

# Apply custom y-tick labels with converted time
plt.yticks(ticks=np.arange(0, max(manual_time) + 1, step=50),
           labels=[convert_time(val) for val in np.arange(0, max(manual_time) + 1, step=50)])

# Show plot
plt.show()
