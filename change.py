# Nama file
file_path = "start.js"
file_path = "replace.js"

# Membuka dan membaca isi file
with open(file_path, "r") as file:
    file_content = file.read()

# Mengubah kode sesuai dengan instruksi
file_content = file_content.replace(
    "const amount = ethers.parseUnits('1.5', 'ether');",
    "const amount = ethers.parseUnits('1', 'ether');"
)

file_content = file_content.replace(
    "const values = recipients.map(() => ethers.parseUnits('1.5', 'ether'));",
    "const values = recipients.map(() => ethers.parseUnits('1', 'ether'));"
)
file_content = file_content.replace(
    "value: ethers.parseUnits('1.5', 'ether')",
    "value: ethers.parseUnits('1', 'ether')"
)

# Menulis ulang file dengan perubahan
with open(file_path, "w") as file:
    file.write(file_content)

print("File berhasil diperbarui!")
